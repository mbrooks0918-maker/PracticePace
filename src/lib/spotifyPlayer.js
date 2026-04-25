// ── Spotify Web Playback SDK singleton ───────────────────────────────────────
// Lives at MODULE level — one instance for the entire app lifetime.
// React components subscribe/unsubscribe but NEVER disconnect the player.
// This means music continues playing when the user switches tabs.

import {
  getStoredToken, isTokenExpired, refreshToken, clearTokens,
  transferPlayback,
  play   as apiPlay,
  pause  as apiPause,
  next   as apiNext,
  previous as apiPrevious,
  setVolume as apiSetVolume,
} from './spotify.js'

const DEVICE_KEY = 'pp_spotify_device_id'

// ── Module-level state (survives component unmount) ───────────────────────────
let player       = null
let deviceId     = localStorage.getItem(DEVICE_KEY) ?? null
let isReady      = false
let isPlaying    = false
let currentTrack = null
let volume       = 50   // 0–100

// ── Pub/sub ───────────────────────────────────────────────────────────────────
const listeners = new Set()

function emit(type, payload) {
  listeners.forEach(fn => { try { fn(type, payload) } catch {} })
}

/** Subscribe to player events. Returns an unsubscribe function.
 *  Components call this on mount and the returned fn on unmount.
 *  Do NOT disconnect the player on unmount — just unsubscribe. */
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Snapshot of current state — safe to call at any time. */
export function getSnapshot() {
  return { isReady, isPlaying, currentTrack, volume, deviceId }
}

export function isConnected() {
  return !!getStoredToken()
}

// ── Token helper ──────────────────────────────────────────────────────────────
async function getFreshToken() {
  try {
    if (isTokenExpired()) await refreshToken()
    return getStoredToken()
  } catch { return null }
}

// ── Player init ───────────────────────────────────────────────────────────────
export function initPlayer() {
  if (player)             return   // Already running
  if (!getStoredToken())  return   // Not authenticated
  if (!window.Spotify)    return   // SDK not loaded yet

  player = new window.Spotify.Player({
    name: 'PracticePace',
    getOAuthToken: cb => getFreshToken().then(t => { if (t) cb(t) }),
    volume: volume / 100,
  })

  player.addListener('ready', ({ device_id }) => {
    console.log('[Spotify] SDK ready, device ID:', device_id)
    deviceId = device_id
    isReady  = true
    localStorage.setItem(DEVICE_KEY, device_id)
    // Claim device silently — don't start playing
    transferPlayback(device_id, false).catch(() => {})
    emit('state', getSnapshot())
  })

  player.addListener('not_ready', () => {
    isReady = false
    emit('state', getSnapshot())
  })

  player.addListener('player_state_changed', state => {
    if (!state) return
    isPlaying = !state.paused
    const track = state.track_window?.current_track
    if (track) {
      currentTrack = {
        name:   track.name,
        artist: track.artists?.map(a => a.name).join(', ') ?? '',
        art:    track.album?.images?.[0]?.url ?? null,
      }
    }
    emit('state', getSnapshot())
  })

  player.addListener('initialization_error', ({ message }) => emit('error', message))
  player.addListener('authentication_error',  ({ message }) => emit('error', message))
  player.addListener('account_error', ({ message }) =>
    emit('error', 'Spotify Premium is required for in-app playback. ' + message)
  )

  player.connect()
}

/** Call once at app startup (e.g. in App.jsx useEffect).
 *  Handles both "SDK already loaded" and "SDK not yet loaded" cases. */
export function setupSpotifySDK() {
  if (window.Spotify) {
    initPlayer()
  } else {
    // SDK fires this global when it finishes loading
    window.onSpotifyWebPlaybackSDKReady = initPlayer
  }
}

// ── URI / device validation helpers ──────────────────────────────────────────
/** Convert any Spotify URL or URI to the spotify:type:id format the API requires. */
function normalizeSpotifyUri(raw) {
  if (!raw) return undefined

  // Already a proper URI — pass through
  if (/^spotify:(playlist|album|artist|show|episode|track):[A-Za-z0-9]+$/.test(raw)) {
    return raw
  }

  // https://open.spotify.com/playlist/37i9dQZF1DX... → spotify:playlist:37i9dQZF1DX
  const urlMatch = raw.match(/open\.spotify\.com\/(playlist|album|artist|show|episode|track)\/([A-Za-z0-9]+)/)
  if (urlMatch) return `spotify:${urlMatch[1]}:${urlMatch[2]}`

  // Unrecognised format — return undefined so the API does a plain resume
  console.warn('[Spotify] Unrecognised URI format, ignoring context:', raw)
  return undefined
}

// ── Playback controls ─────────────────────────────────────────────────────────
/** Transfer + play. Pass contextUri for a playlist/album, omit to resume. */
export async function playTrack(contextUri) {
  const id = deviceId

  // Validate device ID
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new Error('Spotify device not ready — please wait a moment and try again.')
  }

  // Normalise URI so URLs and malformed values don't reach the API
  const uri = normalizeSpotifyUri(contextUri)

  console.log('[Spotify] Attempting play:', { playlistUri: uri, deviceId: id, isReady })

  // Transfer playback to this device first, then wait 250ms for Spotify to
  // register the transfer before sending the play command — without this delay
  // the play API returns 404 "Device not found" even with a valid device_id
  await transferPlayback(id, false)
  await new Promise(r => setTimeout(r, 250))

  await apiPlay({ contextUri: uri, deviceId: id })
  console.log('[Spotify] Play command sent successfully')
  isPlaying = true
  emit('state', getSnapshot())
}

export async function pauseTrack() {
  await apiPause(deviceId)
  isPlaying = false
  emit('state', getSnapshot())
}

export async function nextTrack()     { await apiNext(deviceId) }
export async function prevTrack()     { await apiPrevious(deviceId) }

export async function setVol(pct) {
  volume = Math.round(pct)
  if (player) player.setVolume(pct / 100).catch(() => {})
  await apiSetVolume(pct, deviceId)
  emit('state', getSnapshot())
}

// ── Volume ducking for air horn ───────────────────────────────────────────────
/** Ducks Spotify to 20 %, plays the horn, then restores volume after 2 s. */
export async function duckForHorn(hornFn) {
  const prevVol    = volume
  const shouldDuck = (isReady || deviceId) && isPlaying && prevVol > 25

  if (shouldDuck) {
    try {
      if (player) player.setVolume(0.20).catch(() => {})
      await apiSetVolume(20, deviceId)
    } catch {}
  }

  try { await hornFn() } catch {}

  if (shouldDuck) {
    setTimeout(async () => {
      try {
        volume = prevVol
        if (player) player.setVolume(prevVol / 100).catch(() => {})
        await apiSetVolume(prevVol, deviceId)
        emit('state', getSnapshot())
      } catch {}
    }, 2000)
  }
}

// ── Disconnect ────────────────────────────────────────────────────────────────
export function disconnectPlayer() {
  if (player) { player.disconnect(); player = null }
  deviceId     = null
  isReady      = false
  isPlaying    = false
  currentTrack = null
  localStorage.removeItem(DEVICE_KEY)
  clearTokens()
  emit('state', getSnapshot())
}
