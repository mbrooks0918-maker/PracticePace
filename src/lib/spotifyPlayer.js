// ── Spotify player singleton ──────────────────────────────────────────────────
// Combines the Web Playback SDK (in-browser player, iPad = active device) with
// the Web API (remote control of external devices as fallback).
//
// SDK LOADING RULE: the SDK script is injected dynamically, ONLY after the user
// has a valid token, and ONLY after stale service workers are cleared first.
// Never add it to index.html — a broken/cached SDK service worker intercepts
// ALL fetch() calls on the page and hangs Supabase auth.

import {
  getStoredToken, isTokenExpired, refreshToken, clearTokens,
  transferPlayback,
  play        as apiPlay,
  pause       as apiPause,
  next        as apiNext,
  previous    as apiPrevious,
  setVolume   as apiSetVolume,
  getDevices,
  getCurrentTrack,
} from './spotify.js'

const DEVICE_KEY = 'pp_spotify_device_id'

// ── Module-level state ────────────────────────────────────────────────────────
let player       = null    // window.Spotify.Player instance
let deviceId     = localStorage.getItem(DEVICE_KEY) ?? null
let sdkReady     = false   // SDK player connected and ready
let sdkFailed    = false   // SDK failed to load / init
let sdkLoading   = false   // SDK script is being fetched
let devices      = []      // external devices (API fallback / supplement)
let isPlaying    = false
let currentTrack = null
let volume       = 50      // 0–100

// ── Pub/sub ───────────────────────────────────────────────────────────────────
const listeners = new Set()

function emit(type, payload) {
  listeners.forEach(fn => { try { fn(type, payload) } catch {} })
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSnapshot() {
  return { deviceId, devices, sdkReady, sdkFailed, sdkLoading, isPlaying, currentTrack, volume }
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

// ── Service-worker cleanup ────────────────────────────────────────────────────
// Called before injecting the SDK script. At this point no Spotify SW should
// be active yet (main.jsx removed stale ones at startup), so this is just a
// belt-and-suspenders pass — any Spotify SW still lurking here is, by
// definition, a leftover from a broken previous session and safe to remove.
async function clearServiceWorkers() {
  if (!('serviceWorker' in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      regs
        .filter(r => (r.scriptURL ?? '').toLowerCase().includes('spotify'))
        .map(r => {
          console.log('[SW] Unregistering stale Spotify SW before SDK load:', r.scope)
          return r.unregister()
        })
    )
    // Also nuke all caches so no stale SW response is replayed
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch (err) {
    console.warn('[SW] Cleanup error (non-fatal):', err.message)
  }
}

// ── SDK init ──────────────────────────────────────────────────────────────────
function initPlayer() {
  if (player)            return   // already running
  if (!getStoredToken()) return   // not authenticated
  if (!window.Spotify)   return   // SDK not loaded yet

  console.log('[Spotify] Initialising Web Playback SDK player')

  player = new window.Spotify.Player({
    name:               'PracticePace',
    getOAuthToken:      cb => getFreshToken().then(t => { if (t) cb(t) }),
    volume:             volume / 100,
    // Prevent the SDK from registering with the OS media session controls.
    // Does not disable the service worker, but reduces the SDK's footprint.
    enableMediaSession: false,
  })

  player.addListener('ready', ({ device_id }) => {
    console.log('[Spotify] SDK ready — device_id:', device_id)
    deviceId  = device_id
    sdkReady  = true
    sdkFailed = false
    localStorage.setItem(DEVICE_KEY, device_id)
    // Silently claim this device; don't start playing
    transferPlayback(device_id, false).catch(() => {})
    emit('state', getSnapshot())

    // Leave the Spotify SW running — it is required for audio playback.
    // Cleanup happens via the beforeunload listener in main.jsx when the
    // user closes/leaves the page, at which point audio has already stopped.
  })

  player.addListener('not_ready', ({ device_id }) => {
    console.warn('[Spotify] SDK not ready — device_id:', device_id)
    sdkReady = false
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

  player.addListener('initialization_error', ({ message }) => {
    console.error('[Spotify] SDK initialization_error:', message)
    sdkFailed  = true
    sdkLoading = false
    emit('state', getSnapshot())
    emit('error', message)
  })

  player.addListener('authentication_error', ({ message }) => {
    console.error('[Spotify] SDK authentication_error:', message)
    sdkFailed  = true
    sdkLoading = false
    emit('state', getSnapshot())
    emit('error', message)
  })

  player.addListener('account_error', ({ message }) => {
    const msg = 'Spotify Premium is required for in-app playback. ' + message
    console.error('[Spotify] SDK account_error:', message)
    sdkFailed  = true
    sdkLoading = false
    emit('state', getSnapshot())
    emit('error', msg)
  })

  player.connect()
}

// ── SDK setup — call once when user has a valid token ─────────────────────────
/** Clear stale SWs then dynamically inject the Spotify SDK.
 *  Safe to call multiple times — idempotent. */
export async function setupSpotifySDK() {
  if (!getStoredToken())  return   // not connected
  if (player)             return   // already initialised
  if (sdkLoading)         return   // already in flight

  sdkLoading = true
  emit('state', getSnapshot())

  // Step 1: nuke any stale service workers BEFORE the SDK script runs
  await clearServiceWorkers()

  // Step 2: if the SDK object is already on window (e.g. dev HMR), go straight to init
  if (window.Spotify) {
    sdkLoading = false
    initPlayer()
    return
  }

  // Step 3: inject the script tag exactly once
  if (document.querySelector('script[src*="spotify-player"]')) {
    // Script tag exists but SDK not ready yet — callback will fire soon
    window.onSpotifyWebPlaybackSDKReady = () => { sdkLoading = false; initPlayer() }
    return
  }

  window.onSpotifyWebPlaybackSDKReady = () => {
    sdkLoading = false
    initPlayer()
  }

  const script   = document.createElement('script')
  script.src     = 'https://sdk.scdn.co/spotify-player.js'
  script.async   = true
  script.onerror = () => {
    console.error('[Spotify] SDK script failed to load — switching to device picker')
    sdkLoading = false
    sdkFailed  = true
    emit('state', getSnapshot())
    emit('error', 'Spotify in-app player failed to load. Select an external device below.')
  }
  document.body.appendChild(script)
  console.log('[Spotify] SDK script injected (SWs cleared first)')
}

// ── URI normaliser ────────────────────────────────────────────────────────────
function normalizeSpotifyUri(raw) {
  if (!raw) return undefined
  if (/^spotify:(playlist|album|artist|show|episode|track):[A-Za-z0-9]+$/.test(raw)) return raw
  const m = raw.match(/open\.spotify\.com\/(playlist|album|artist|show|episode|track)\/([A-Za-z0-9]+)/)
  if (m) return `spotify:${m[1]}:${m[2]}`
  console.warn('[Spotify] Unrecognised URI format, ignoring:', raw)
  return undefined
}

// ── External device management (fallback / supplement) ────────────────────────
export async function refreshDevices() {
  try {
    if (isTokenExpired()) await refreshToken()
    const list = await getDevices()
    devices = list ?? []
    // Don't evict the SDK device — it may not appear while SDK is connecting
    if (deviceId && !sdkReady && !devices.find(d => d.id === deviceId)) {
      deviceId = null
      localStorage.removeItem(DEVICE_KEY)
    }
    emit('state', getSnapshot())
    return devices
  } catch (err) {
    console.error('[Spotify] refreshDevices error:', err.message)
    return []
  }
}

export function selectDevice(id) {
  deviceId = id ?? null
  if (deviceId) localStorage.setItem(DEVICE_KEY, deviceId)
  else          localStorage.removeItem(DEVICE_KEY)
  emit('state', getSnapshot())
}

// ── Playback controls ─────────────────────────────────────────────────────────
export async function playTrack(contextUri) {
  if (!deviceId) throw new Error('No device ready — please wait for the player to connect, or select an external device.')

  const uri = normalizeSpotifyUri(contextUri)
  console.log('[Spotify] play →', { uri, deviceId, sdkReady })

  if (!sdkReady) {
    // External device: transfer first then play
    await transferPlayback(deviceId, false)
    await new Promise(r => setTimeout(r, 300))
  }

  await apiPlay({ contextUri: uri, deviceId })
  isPlaying    = true
  currentTrack = currentTrack ?? null
  emit('state', getSnapshot())
}

export async function pauseTrack() {
  await apiPause(deviceId)
  isPlaying = false
  emit('state', getSnapshot())
}

export async function nextTrack() { await apiNext(deviceId) }
export async function prevTrack() { await apiPrevious(deviceId) }

export async function setVol(pct) {
  volume = Math.round(pct)
  if (player) player.setVolume(pct / 100).catch(() => {})
  await apiSetVolume(pct, deviceId)
  emit('state', getSnapshot())
}

// ── Polling for external-device track state ───────────────────────────────────
// Only needed when SDK is not ready (SDK emits player_state_changed events itself)
let _pollTimer = null

export function startPolling(intervalMs = 6000) {
  if (_pollTimer) return
  _pollTimer = setInterval(async () => {
    if (sdkReady || !isConnected() || !deviceId) return  // SDK handles its own state
    try {
      const data = await getCurrentTrack()
      if (data?.item) {
        isPlaying    = !!data.is_playing
        currentTrack = {
          name:   data.item.name,
          artist: data.item.artists?.map(a => a.name).join(', ') ?? '',
          art:    data.item.album?.images?.[0]?.url ?? null,
        }
      } else {
        isPlaying    = false
        currentTrack = null
      }
      emit('state', getSnapshot())
    } catch { /* network blip — ignore */ }
  }, intervalMs)
}

export function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null }
}

// ── Volume ducking for air horn ───────────────────────────────────────────────
export async function duckForHorn(hornFn) {
  const prevVol    = volume
  const shouldDuck = deviceId && isPlaying && prevVol > 25

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
  stopPolling()
  if (player) { player.disconnect(); player = null }
  deviceId     = null
  devices      = []
  sdkReady     = false
  sdkFailed    = false
  sdkLoading   = false
  isPlaying    = false
  currentTrack = null
  localStorage.removeItem(DEVICE_KEY)
  clearTokens()
  emit('state', getSnapshot())
}
