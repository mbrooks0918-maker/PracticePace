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

// ── Exchange code for token ───────────────────────────────────────────────────
export async function exchangeCode(code) {
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error('No PKCE verifier found — please try connecting again.')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  REDIRECT_URI,
      code_verifier: verifier,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description ?? data.error)
  storeTokens(data)
  localStorage.removeItem(VERIFIER_KEY)
  return data
}

// ── Refresh token ─────────────────────────────────────────────────────────────
export async function refreshToken() {
  const rt = localStorage.getItem(REFRESH_KEY)
  if (!rt) throw new Error('No refresh token stored.')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    'refresh_token',
      refresh_token: rt,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description ?? data.error)
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

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (res.status === 204 || res.status === 202) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Spotify API error ${res.status}`)
  }
  return res.json()
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
  const params  = deviceId ? `?device_id=${deviceId}` : ''
  // Only set body + Content-Type when we have a context_uri.
  // Sending Content-Type: application/json with an empty body causes Spotify
  // to return "The string did not match the expected pattern".
  const hasBody = !!contextUri
  const body    = hasBody ? JSON.stringify({ context_uri: contextUri }) : undefined
  return api(`/me/player/play${params}`, {
    method:  'PUT',
    body,
    headers: hasBody ? {} : { 'Content-Type': 'text/plain' },
  })
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
  const all = []
  let url   = '/me/playlists?limit=50'
  while (url) {
    const data = await api(url.startsWith('http') ? url.replace('https://api.spotify.com/v1', '') : url)
    all.push(...(data?.items ?? []))
    url = data?.next ? data.next.replace('https://api.spotify.com/v1', '') : null
  }
  return all
}
