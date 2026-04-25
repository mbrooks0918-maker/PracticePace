import { useState, useRef, useEffect, useCallback } from 'react'
import {
  playAirHorn, playWhistle, playStadiumCrowd,
  playPeriodEnd, playDrumline, playCrowdClap,
  getAutoSounds, setAutoSound, resumeCtx,
} from '../../lib/sounds'
import {
  getAuthUrl, getStoredToken, clearTokens,
  getPlaylists, getCurrentTrack,
  play, pause, next, previous, setVolume, transferPlayback,
  refreshToken, isTokenExpired,
} from '../../lib/spotify'

// ── Sound definitions ─────────────────────────────────────────────────────────
const SOUNDS = [
  {
    key: 'airhorn', label: 'Air Horn', fn: playAirHorn,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      </svg>
    ),
  },
  {
    key: 'whistle', label: 'Whistle', fn: playWhistle,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="14" r="5"/>
        <path d="M21 3 9.5 10"/>
        <path d="M15 9.5 21 3"/>
      </svg>
    ),
  },
  {
    key: 'crowd', label: 'Crowd Roar', fn: playStadiumCrowd,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key: 'periodend', label: 'Buzzer', fn: playPeriodEnd,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    key: 'drumline', label: 'Drumline', fn: playDrumline,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 5v14a9 3 0 0 1-18 0V5"/>
        <path d="M3 12a9 3 0 0 0 18 0"/>
      </svg>
    ),
  },
  {
    key: 'crowdclap', label: 'Crowd Clap', fn: playCrowdClap,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2v7.5"/>
        <path d="M9.5 4.5v5"/>
        <path d="M4.5 7v5"/>
        <path d="M4.5 12c0 5.25 4.25 9.5 9.5 9.5s9.5-4.25 9.5-9.5"/>
        <path d="M19.5 7v5"/>
      </svg>
    ),
  },
]

const AUTO_TOGGLES = [
  { key: 'hornOnEnd',      label: 'Air horn when period ends',  default: true },
  { key: 'whistleAt60',    label: 'Whistle at 1:00 remaining',  default: true },
  { key: 'alertOnOverrun', label: 'Alert when overrun starts',  default: false },
]

function Toggle({ label, value, onChange, orgColor }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-all"
      style={{
        backgroundColor: value ? `${orgColor}18` : '#1a0000',
        border:          `1px solid ${value ? orgColor + '66' : '#2a0000'}`,
      }}
    >
      <span
        className="w-10 h-6 rounded-full relative flex-shrink-0 transition-colors"
        style={{ backgroundColor: value ? orgColor : '#2a0000' }}
      >
        <span
          className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow"
          style={{ left: value ? '22px' : '2px' }}
        />
      </span>
      <span className="text-sm font-semibold" style={{ color: value ? '#fff' : '#9a8080' }}>
        {label}
      </span>
    </button>
  )
}

// ── Spotify Player ────────────────────────────────────────────────────────────
function SpotifyPlayer({ orgColor }) {
  const [isReady,        setIsReady]        = useState(false)
  const [deviceId,       setDeviceId]       = useState(null)
  const [isPlaying,      setIsPlaying]      = useState(false)
  const [currentTrack,   setCurrentTrack]   = useState(null)
  const [volume,         setVolumeState]    = useState(50)
  const [playlists,      setPlaylists]      = useState([])
  const [selectedUri,    setSelectedUri]    = useState('')
  const [loadingLists,   setLoadingLists]   = useState(true)
  const [error,          setError]          = useState('')
  const [sdkError,       setSdkError]       = useState('')

  const playerRef    = useRef(null)
  const pollRef      = useRef(null)

  // ── Initialize Web Playback SDK ───────────────────────────────────────────
  useEffect(() => {
    // Ensure token is valid before initializing
    async function getToken() {
      try {
        if (isTokenExpired()) await refreshToken()
        return getStoredToken()
      } catch {
        return null
      }
    }

    function initPlayer() {
      if (!window.Spotify) { setSdkError('Spotify SDK not loaded. Please refresh the page.'); return }

      const player = new window.Spotify.Player({
        name: 'PracticePace',
        getOAuthToken: cb => getToken().then(t => { if (t) cb(t) }),
        volume: 0.5,
      })

      player.addListener('ready', ({ device_id }) => {
        setDeviceId(device_id)
        setIsReady(true)
        // Transfer playback to this device (don't auto-start)
        transferPlayback(device_id, false).catch(() => {})
      })

      player.addListener('not_ready', () => {
        setIsReady(false)
      })

      player.addListener('player_state_changed', state => {
        if (!state) return
        setIsPlaying(!state.paused)
        const track = state.track_window?.current_track
        if (track) {
          setCurrentTrack({
            name:    track.name,
            artist:  track.artists?.map(a => a.name).join(', '),
            album:   track.album?.name,
            art:     track.album?.images?.[0]?.url ?? null,
          })
        }
      })

      player.addListener('initialization_error', ({ message }) => setSdkError(message))
      player.addListener('authentication_error', ({ message }) => setSdkError(message))
      player.addListener('account_error',        ({ message }) => setSdkError('Spotify Premium is required for playback. ' + message))

      player.connect()
      playerRef.current = player
    }

    // SDK calls window.onSpotifyWebPlaybackSDKReady when loaded
    if (window.Spotify) {
      initPlayer()
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer
    }

    return () => {
      if (playerRef.current) { playerRef.current.disconnect(); playerRef.current = null }
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // ── Poll currently playing (fallback for state_changed gaps) ─────────────
  useEffect(() => {
    if (!isReady) return
    pollRef.current = setInterval(async () => {
      try {
        const data = await getCurrentTrack()
        if (!data) return
        setIsPlaying(data.is_playing)
        const track = data.item
        if (track) {
          setCurrentTrack({
            name:   track.name,
            artist: track.artists?.map(a => a.name).join(', '),
            album:  track.album?.name,
            art:    track.album?.images?.[0]?.url ?? null,
          })
        }
      } catch { /* ignore poll errors */ }
    }, 5000)
    return () => clearInterval(pollRef.current)
  }, [isReady])

  // ── Load playlists ────────────────────────────────────────────────────────
  useEffect(() => {
    getPlaylists()
      .then(list => { setPlaylists(list); setLoadingLists(false) })
      .catch(e   => { setError(e.message); setLoadingLists(false) })
  }, [])

  // ── Controls ──────────────────────────────────────────────────────────────
  async function handlePlayPause() {
    try {
      if (isPlaying) {
        await pause(deviceId)
        setIsPlaying(false)
      } else {
        if (selectedUri) {
          await play({ contextUri: selectedUri, deviceId })
        } else {
          await play({ deviceId })
        }
        setIsPlaying(true)
      }
    } catch (e) { setError(e.message) }
  }

  async function handleNext()     { try { await next(deviceId)     } catch (e) { setError(e.message) } }
  async function handlePrevious() { try { await previous(deviceId) } catch (e) { setError(e.message) } }

  async function handleVolume(v) {
    setVolumeState(v)
    try { await setVolume(v, deviceId) } catch { /* ignore */ }
    if (playerRef.current) playerRef.current.setVolume(v / 100).catch(() => {})
  }

  async function handlePlaylistSelect(uri) {
    setSelectedUri(uri)
    if (!uri) return
    try {
      await play({ contextUri: uri, deviceId })
      setIsPlaying(true)
    } catch (e) { setError(e.message) }
  }

  function handleDisconnect() {
    if (playerRef.current) playerRef.current.disconnect()
    clearTokens()
    window.location.reload()
  }

  const SPOTIFY_GREEN = '#1db954'

  if (sdkError) {
    return (
      <div className="flex flex-col gap-3 p-4 rounded-xl" style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000' }}>
        <p className="text-xs font-semibold" style={{ color: '#ff6666' }}>{sdkError}</p>
        <button onClick={handleDisconnect} className="text-xs underline self-start" style={{ color: '#9a8080' }}>
          Disconnect and try again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Not yet ready ── */}
      {!isReady && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000' }}>
          <div className="w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0"
            style={{ borderColor: SPOTIFY_GREEN, borderTopColor: 'transparent' }} />
          <p className="text-xs" style={{ color: '#9a8080' }}>Connecting to Spotify device…</p>
        </div>
      )}

      {/* ── Now playing card ── */}
      <div
        className="flex items-center gap-4 p-4 rounded-2xl"
        style={{ backgroundColor: '#0d1a0d', border: `1px solid ${SPOTIFY_GREEN}33` }}
      >
        {/* Album art */}
        <div
          className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: '#1a2a1a' }}
        >
          {currentTrack?.art ? (
            <img src={currentTrack.art} alt="Album art" className="w-full h-full object-cover" />
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1db95466" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
            </svg>
          )}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">
            {currentTrack?.name ?? (isReady ? 'No track playing' : 'Connecting…')}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: '#9a8080' }}>
            {currentTrack?.artist ?? ''}
          </p>
          {isReady && (
            <div className="flex items-center gap-1 mt-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SPOTIFY_GREEN }} />
              <span className="text-xs font-semibold" style={{ color: SPOTIFY_GREEN }}>Connected</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Transport controls ── */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrevious}
          disabled={!isReady}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
          style={{ backgroundColor: '#1a2a1a', color: '#fff' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="19 20 9 12 19 4 19 20"/>
            <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <button
          onClick={handlePlayPause}
          disabled={!isReady}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
          style={{ backgroundColor: SPOTIFY_GREEN, boxShadow: `0 0 24px ${SPOTIFY_GREEN}66` }}
        >
          {isPlaying ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 3 }}>
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          )}
        </button>

        <button
          onClick={handleNext}
          disabled={!isReady}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
          style={{ backgroundColor: '#1a2a1a', color: '#fff' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 4 15 12 5 20 5 4"/>
            <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Volume ── */}
      <div className="flex items-center gap-3 px-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a8080" strokeWidth="2" strokeLinecap="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        </svg>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={e => handleVolume(Number(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${SPOTIFY_GREEN} ${volume}%, #2a0000 ${volume}%)`,
            accentColor: SPOTIFY_GREEN,
          }}
        />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a8080" strokeWidth="2" strokeLinecap="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
      </div>

      {/* ── Playlist selector ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9a8080' }}>
          Play a Playlist
        </label>
        {loadingLists ? (
          <p className="text-xs" style={{ color: '#4a2020' }}>Loading playlists…</p>
        ) : (
          <select
            value={selectedUri}
            onChange={e => handlePlaylistSelect(e.target.value)}
            disabled={!isReady}
            className="rounded-xl px-4 py-3 text-sm outline-none disabled:opacity-40"
            style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#fff' }}
          >
            <option value="">— Choose a playlist —</option>
            {playlists.map(p => (
              <option key={p.id} value={p.uri}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#2a0000', color: '#ff6666' }}>
          {error}
        </p>
      )}

      {/* ── Disconnect ── */}
      <button
        onClick={handleDisconnect}
        className="self-start text-xs underline transition-opacity hover:opacity-60"
        style={{ color: '#6a3030' }}
      >
        Disconnect Spotify
      </button>
    </div>
  )
}

// ── Main AudioSection ─────────────────────────────────────────────────────────
export default function AudioSection({ orgColor }) {
  const [autoSounds, setAutoSoundsState] = useState(() => {
    const saved = getAutoSounds()
    const defaults = {}
    AUTO_TOGGLES.forEach(t => { defaults[t.key] = saved[t.key] ?? t.default })
    return defaults
  })
  const [playing, setPlaying]             = useState(null)
  const [unlocked, setUnlocked]           = useState(false)
  const [customSounds, setCustomSounds]   = useState([])
  const [playingCustom, setPlayingCustom] = useState(null)
  const [spotifyConnected, setSpotifyConnected] = useState(() => !!getStoredToken())
  const [connecting, setConnecting]       = useState(false)

  const customInputRef = useRef(null)
  const audioRefs      = useRef({})

  async function unlock() { await resumeCtx(); setUnlocked(true) }

  async function handlePlay(sound) {
    if (!unlocked) await unlock()
    setPlaying(sound.key)
    try { await sound.fn() } catch { /* ignore */ }
    setTimeout(() => setPlaying(p => p === sound.key ? null : p), 2500)
  }

  function handleToggle(key, value) {
    setAutoSoundsState(s => ({ ...s, [key]: value }))
    setAutoSound(key, value)
  }

  function handleCustomUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) { alert('Please select an audio file (MP3, WAV, etc.)'); return }
    const url   = URL.createObjectURL(file)
    const label = file.name.replace(/\.[^.]+$/, '')
    const key   = `custom_${Date.now()}`
    setCustomSounds(s => [...s, { key, label, url }])
    if (customInputRef.current) customInputRef.current.value = ''
  }

  function playCustom(sound) {
    const prev = audioRefs.current[playingCustom]
    if (prev) { prev.pause(); prev.currentTime = 0 }
    if (playingCustom === sound.key) { setPlayingCustom(null); return }
    const audio = new Audio(sound.url)
    audio.volume = 1.0
    audioRefs.current[sound.key] = audio
    audio.play().catch(() => {})
    setPlayingCustom(sound.key)
    audio.onended = () => setPlayingCustom(p => p === sound.key ? null : p)
  }

  function removeCustom(key) {
    setCustomSounds(s => s.filter(c => c.key !== key))
    if (playingCustom === key) {
      const audio = audioRefs.current[key]
      if (audio) { audio.pause(); audio.currentTime = 0 }
      setPlayingCustom(null)
    }
  }

  async function handleConnectSpotify() {
    setConnecting(true)
    try {
      const url = await getAuthUrl()
      window.location.href = url
    } catch (e) {
      alert('Could not generate Spotify auth URL: ' + e.message)
      setConnecting(false)
    }
  }

  const SPOTIFY_GREEN = '#1db954'

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* ── LEFT — Sound Effects ── */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-black text-white text-lg">Sound Effects</h2>
            <p className="text-xs mt-1" style={{ color: '#9a8080' }}>
              Tap any sound to preview. Use your device volume for loudness control.
            </p>
          </div>

          {!unlocked && (
            <button onClick={unlock} className="py-3 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: orgColor }}>
              Tap here to enable audio
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            {SOUNDS.map(sound => {
              const active = playing === sound.key
              return (
                <button
                  key={sound.key}
                  onClick={() => handlePlay(sound)}
                  className="flex flex-col items-center gap-2 rounded-2xl py-5 px-3 transition-all active:scale-95"
                  style={{
                    backgroundColor: active ? `${orgColor}28` : '#1a0000',
                    border:          `2px solid ${active ? orgColor : '#2a0000'}`,
                    boxShadow:       active ? `0 0 20px ${orgColor}44` : 'none',
                    color:           active ? orgColor : '#9a8080',
                  }}
                >
                  {sound.icon}
                  <span className="text-xs font-bold text-center leading-tight">{sound.label}</span>
                  {active && <span className="text-xs animate-pulse font-semibold">▶ playing</span>}
                </button>
              )
            })}
          </div>

          {/* Custom sounds */}
          <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">Custom Sounds</h3>
                <p className="text-xs mt-0.5" style={{ color: '#9a8080' }}>Upload your own MP3 or audio file</p>
              </div>
              <label htmlFor="custom-audio-upload"
                className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all"
                style={{ backgroundColor: `${orgColor}22`, border: `1px solid ${orgColor}`, color: orgColor }}>
                + Upload
              </label>
              <input ref={customInputRef} id="custom-audio-upload" type="file" accept="audio/*"
                onChange={handleCustomUpload} className="hidden" />
            </div>

            {customSounds.length === 0 ? (
              <p className="text-xs text-center py-3" style={{ color: '#4a2020' }}>
                No custom sounds yet — upload an MP3 to add your own.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {customSounds.map(cs => {
                  const isActive = playingCustom === cs.key
                  return (
                    <div key={cs.key} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{
                        backgroundColor: isActive ? `${orgColor}18` : '#1a0000',
                        border:          `1px solid ${isActive ? orgColor + '66' : '#2a0000'}`,
                      }}>
                      <button onClick={() => playCustom(cs)}
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                        style={{ backgroundColor: isActive ? orgColor : '#2a0000', color: '#fff' }}>
                        {isActive ? '⏹' : '▶'}
                      </button>
                      <span className="flex-1 text-sm font-semibold truncate"
                        style={{ color: isActive ? '#fff' : '#9a8080' }}>
                        {cs.label}
                      </span>
                      <button onClick={() => removeCustom(cs.key)} className="text-xs px-2 py-1 rounded"
                        style={{ color: '#6a3030' }}>✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT — Auto-Sounds + Music ── */}
        <div className="flex flex-col gap-6">

          {/* Auto-sounds */}
          <div className="flex flex-col gap-4 p-5 rounded-2xl" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
            <div>
              <h3 className="font-bold text-white text-base">Auto Sounds</h3>
              <p className="text-xs mt-1" style={{ color: '#9a8080' }}>
                Sounds that fire automatically during practice. Settings save to this device.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {AUTO_TOGGLES.map(t => (
                <Toggle
                  key={t.key}
                  label={t.label}
                  value={autoSounds[t.key] ?? t.default}
                  onChange={v => handleToggle(t.key, v)}
                  orgColor={orgColor}
                />
              ))}
            </div>
          </div>

          {/* Music / Spotify */}
          <div className="flex flex-col gap-4 p-5 rounded-2xl"
            style={{ backgroundColor: '#110000', border: `1px solid ${spotifyConnected ? SPOTIFY_GREEN + '44' : '#2a0000'}` }}>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Spotify logo */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill={SPOTIFY_GREEN}>
                  <circle cx="12" cy="12" r="12"/>
                  <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15C9.65 6.8 15.6 7 19.35 9.2c.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25m-.1 2.8c-.25.4-.75.5-1.15.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.4.25.5.75.3 1m-1.3 2.8c-.2.35-.65.45-1 .25-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.35.15.4.65.4 1" fill="white"/>
                </svg>
                <h3 className="font-bold text-white text-base">Spotify</h3>
              </div>
              {spotifyConnected && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: '#0d1a0d', border: `1px solid ${SPOTIFY_GREEN}66`, color: SPOTIFY_GREEN }}>
                  ✓ Connected
                </span>
              )}
            </div>

            {spotifyConnected ? (
              <SpotifyPlayer orgColor={orgColor} />
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-xs leading-relaxed" style={{ color: '#9a8080' }}>
                  Connect your Spotify account to control music playback during practice. Requires Spotify Premium.
                </p>
                <button
                  onClick={handleConnectSpotify}
                  disabled={connecting}
                  className="flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
                  style={{ backgroundColor: SPOTIFY_GREEN, boxShadow: `0 0 20px ${SPOTIFY_GREEN}44` }}
                >
                  {connecting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 animate-spin"
                        style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                      Redirecting…
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <circle cx="12" cy="12" r="12" fill="none"/>
                        <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15C9.65 6.8 15.6 7 19.35 9.2c.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25m-.1 2.8c-.25.4-.75.5-1.15.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.4.25.5.75.3 1m-1.3 2.8c-.2.35-.65.45-1 .25-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.35.15.4.65.4 1"/>
                      </svg>
                      Connect Spotify
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
