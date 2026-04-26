// ── Spotify PKCE OAuth + Web API ──────────────────────────────────────────────
const CLIENT_ID   = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = 'https://practicepace.app/spotify/callback'
const SCOPES = [
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-email',
  'user-read-private',
].join(' ')

const TOKEN_KEY         = 'pp_spotify_token'
const REFRESH_KEY       = 'pp_spotify_refresh_token'
const EXPIRY_KEY        = 'pp_spotify_token_expiry'
const VERIFIER_KEY      = 'pp_spotify_verifier'

// ── PKCE helpers ──────────────────────────────────────────────────────────────
function generateVerifier(length = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const arr   = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => chars[b % chars.length]).join('')
}

async function generateChallenge(verifier) {
  const data    = new TextEncoder().encode(verifier)
  const digest  = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ── Token storage helpers ─────────────────────────────────────────────────────
export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function isTokenExpired() {
  const expiry = localStorage.getItem(EXPIRY_KEY)
  if (!expiry) return true
  return Date.now() > parseInt(expiry, 10) - 60_000  // 60s buffer
}

function storeTokens({ access_token, refresh_token, expires_in }) {
  localStorage.setItem(TOKEN_KEY,   access_token)
  localStorage.setItem(EXPIRY_KEY,  String(Date.now() + expires_in * 1000))
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(EXPIRY_KEY)
  localStorage.removeItem(VERIFIER_KEY)
}

// ── Auth URL (PKCE) ───────────────────────────────────────────────────────────
export async function getAuthUrl() {
  const verifier   = generateVerifier()
  const challenge  = await generateChallenge(verifier)
  localStorage.setItem(VERIFIER_KEY, verifier)

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         'code',
    redirect_uri:          REDIRECT_URI,
    scope:                 SCOPES,
    code_challenge_method: 'S256',
    code_challenge:        challenge,
  })
  return `https://accounts.spotify.com/authorize?${params}`
}

// ── Internal helper: call our serverless token endpoint ───────────────────────
// Avoids hitting Spotify directly from the browser (no client secret exposure,
// no non-JSON parse errors, proper server-side error logging).
async function callTokenEndpoint(body) {
  const res = await fetch('/api/spotify-token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  // Always read as text first — the serverless fn guarantees JSON, but guard anyway
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Unexpected response from token server: ${text.slice(0, 120)}`)
  }

  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? data.error ?? `Token request failed (${res.status})`)
  }
  return data
}

// ── Exchange code for token ───────────────────────────────────────────────────
export async function exchangeCode(code) {
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error('No PKCE verifier found — please try connecting again.')

  const data = await callTokenEndpoint({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  REDIRECT_URI,
    code_verifier: verifier,
  })

  storeTokens(data)
  localStorage.removeItem(VERIFIER_KEY)
  return data
}

// ── Refresh token ─────────────────────────────────────────────────────────────
export async function refreshToken() {
  const rt = localStorage.getItem(REFRESH_KEY)
  if (!rt) throw new Error('No refresh token stored.')

  const data = await callTokenEndpoint({
    grant_type:    'refresh_token',
    refresh_token: rt,
  })

  storeTokens(data)
  return data.access_token
}

// ── Authenticated API call (auto-refresh) ─────────────────────────────────────
async function api(path, options = {}) {
  let token = getStoredToken()
  if (!token) throw new Error('Not connected to Spotify.')

  if (isTokenExpired()) {
    token = await refreshToken()
  }

  // Only include Content-Type when there is a body — sending it with an
  // empty PUT causes Spotify to return "string did not match expected pattern"
  const contentType = options.body !== undefined
    ? { 'Content-Type': 'application/json' }
    : {}

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...contentType,
      ...(options.headers ?? {}),
    },
  })

  // 204 / 202 = success with no body (pause, skip, volume, transfer, etc.)
  if (res.status === 204 || res.status === 202) return null

  // Read body as text first — Spotify occasionally returns plain-text on some
  // 200s (e.g. "Success"), which breaks res.json() with "Unexpected token 'S'"
  const raw = await res.text().catch(() => '')

  if (!res.ok) {
    console.error('[Spotify] API error', res.status, path, raw)
    let msg = `Spotify API error ${res.status}`
    try { msg = JSON.parse(raw)?.error?.message ?? msg } catch {}
    throw new Error(msg)
  }

  // Empty body on a 2xx — nothing to parse
  if (!raw || raw.trim() === '') return null

  try {
    return JSON.parse(raw)
  } catch {
    // Non-JSON success response — log and return null rather than crashing
    console.warn('[Spotify] Non-JSON response on', path, '—', raw.slice(0, 80))
    return null
  }
}

// ── Playback ──────────────────────────────────────────────────────────────────
export async function getDevices() {
  const data = await api('/me/player/devices')
  return data?.devices ?? []
}

export async function getCurrentTrack() {
  return api('/me/player/currently-playing')
}

export async function play({ contextUri, deviceId } = {}) {
  const params = deviceId ? `?device_id=${deviceId}` : ''
  // No body at all when just resuming — api() will omit Content-Type automatically
  const body   = contextUri ? JSON.stringify({ context_uri: contextUri }) : undefined
  console.log('[Spotify] play() →', { contextUri, deviceId, hasBody: !!body })
  const result = await api(`/me/player/play${params}`, { method: 'PUT', body })
  console.log('[Spotify] play() ← status OK (204/200)')
  return result
}

export async function pause(deviceId) {
  const params = deviceId ? `?device_id=${deviceId}` : ''
  return api(`/me/player/pause${params}`, { method: 'PUT' })
}

export async function next(deviceId) {
  const params = deviceId ? `?device_id=${deviceId}` : ''
  return api(`/me/player/next${params}`, { method: 'POST' })
}

export async function previous(deviceId) {
  const params = deviceId ? `?device_id=${deviceId}` : ''
  return api(`/me/player/previous${params}`, { method: 'POST' })
}

export async function setVolume(percent, deviceId) {
  const params = new URLSearchParams({ volume_percent: Math.round(percent) })
  if (deviceId) params.set('device_id', deviceId)
  return api(`/me/player/volume?${params}`, { method: 'PUT' })
}

export async function transferPlayback(deviceId, play = false) {
  return api('/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play }),
  })
}

// ── Playlists ─────────────────────────────────────────────────────────────────
export async function getPlaylists() {
  console.log('[Spotify] Fetching playlists — token present:', !!getStoredToken(), '| expired:', isTokenExpired())
  const all = []
  let url   = '/me/playlists?limit=50'
  try {
    while (url) {
      const data = await api(url.startsWith('http') ? url.replace('https://api.spotify.com/v1', '') : url)
      all.push(...(data?.items ?? []))
      url = data?.next ? data.next.replace('https://api.spotify.com/v1', '') : null
    }
    console.log('[Spotify] Playlists loaded:', all.length)
    return all
  } catch (err) {
    console.log('[Spotify] Playlist fetch error:', err)
    throw err
  }
}
