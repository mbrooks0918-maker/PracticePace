// ── Spotify Web API remote control ────────────────────────────────────────────
// NO Web Playback SDK — no service worker, no browser player.
// PracticePace controls playback on whatever Spotify device the coach already
// has open (phone, laptop, desktop app).  The coach opens Spotify somewhere,
// picks it in the device list, and PracticePace drives it remotely via the API.

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
let deviceId     = localStorage.getItem(DEVICE_KEY) ?? null
let devices      = []        // list of available Spotify devices
let isPlaying    = false
let currentTrack = null
let volume       = 50        // 0–100

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
  return { deviceId, devices, isPlaying, currentTrack, volume }
}

export function isConnected() {
  return !!getStoredToken()
}

// ── Device management ─────────────────────────────────────────────────────────
/** Fetch available Spotify devices and update state. */
export async function refreshDevices() {
  try {
    if (isTokenExpired()) await refreshToken()
    const list = await getDevices()
    devices = list ?? []
    // Clear saved device if it's no longer visible
    if (deviceId && !devices.find(d => d.id === deviceId)) {
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

/** Select a device to control.  Persists across page loads. */
export function selectDevice(id) {
  deviceId = id ?? null
  if (deviceId) localStorage.setItem(DEVICE_KEY, deviceId)
  else          localStorage.removeItem(DEVICE_KEY)
  emit('state', getSnapshot())
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

// ── Playback controls ─────────────────────────────────────────────────────────
export async function playTrack(contextUri) {
  if (!deviceId) throw new Error('No Spotify device selected — open Spotify on a device first, then tap Refresh.')

  const uri = normalizeSpotifyUri(contextUri)
  console.log('[Spotify] play →', { uri, deviceId })

  // Transfer to device first, brief pause lets Spotify register it
  await transferPlayback(deviceId, false)
  await new Promise(r => setTimeout(r, 300))
  await apiPlay({ contextUri: uri, deviceId })

  isPlaying    = true
  currentTrack = null   // will update on next poll
  emit('state', getSnapshot())
}

export async function pauseTrack() {
  await apiPause(deviceId)
  isPlaying = false
  emit('state', getSnapshot())
}

export async function nextTrack()  { await apiNext(deviceId) }
export async function prevTrack()  { await apiPrevious(deviceId) }

export async function setVol(pct) {
  volume = Math.round(pct)
  await apiSetVolume(pct, deviceId)
  emit('state', getSnapshot())
}

// ── Polling: keep currentTrack / isPlaying in sync ───────────────────────────
let _pollTimer = null

export function startPolling(intervalMs = 6000) {
  if (_pollTimer) return
  _pollTimer = setInterval(async () => {
    if (!isConnected() || !deviceId) return
    try {
      const data = await getCurrentTrack()
      if (data?.item) {
        isPlaying = !data.is_playing ? false : true
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
    try { await apiSetVolume(20, deviceId) } catch {}
  }

  try { await hornFn() } catch {}

  if (shouldDuck) {
    setTimeout(async () => {
      try {
        volume = prevVol
        await apiSetVolume(prevVol, deviceId)
        emit('state', getSnapshot())
      } catch {}
    }, 2000)
  }
}

// ── Disconnect ────────────────────────────────────────────────────────────────
export function disconnectPlayer() {
  stopPolling()
  deviceId     = null
  devices      = []
  isPlaying    = false
  currentTrack = null
  localStorage.removeItem(DEVICE_KEY)
  clearTokens()
  emit('state', getSnapshot())
}
