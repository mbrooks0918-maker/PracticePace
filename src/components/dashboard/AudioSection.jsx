import { useState, useEffect } from 'react'
import { getAuthUrl, getPlaylists } from '../../lib/spotify'
import {
  subscribe as subscribeSpotify,
  getSnapshot, initPlayer,
  playTrack, pauseTrack, nextTrack, prevTrack, setVol,
  disconnectPlayer, isConnected,
} from '../../lib/spotifyPlayer'

const SPOTIFY_GREEN = '#1db954'

// ── Spotify logo SVG ──────────────────────────────────────────────────────────
function SpotifyLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={SPOTIFY_GREEN}>
      <circle cx="12" cy="12" r="12"/>
      <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15C9.65 6.8 15.6 7 19.35 9.2c.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25m-.1 2.8c-.25.4-.75.5-1.15.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.4.25.5.75.3 1m-1.3 2.8c-.2.35-.65.45-1 .25-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.35.15.4.65.4 1" fill="white"/>
    </svg>
  )
}

// ── Connected player ──────────────────────────────────────────────────────────
function SpotifyPlayer({ orgColor }) {
  const [snap,         setSnap]         = useState(() => getSnapshot())
  const [playlists,    setPlaylists]    = useState([])
  const [selectedUri,  setSelectedUri]  = useState('')
  const [loadingLists, setLoadingLists] = useState(true)
  const [error,        setError]        = useState('')

  const { isReady, isPlaying, currentTrack } = snap

  // Subscribe to singleton — never disconnect on unmount
  useEffect(() => {
    initPlayer()
    return subscribeSpotify((type, payload) => {
      if (type === 'state') setSnap({ ...payload })
      if (type === 'error') setError(payload)
    })
  }, [])

  // Load playlists once
  useEffect(() => {
    getPlaylists()
      .then(list => { setPlaylists(list); setLoadingLists(false) })
      .catch(e   => { setError(e.message); setLoadingLists(false) })
  }, [])

  async function handlePlayPause() {
    try {
      if (isPlaying) { await pauseTrack() } else { await playTrack(selectedUri || undefined) }
      setError('')
    } catch (e) { setError(e.message) }
  }

  async function handleNext()     { try { await nextTrack(); setError('') } catch (e) { setError(e.message) } }
  async function handlePrevious() { try { await prevTrack(); setError('') } catch (e) { setError(e.message) } }
  async function handleVolume(v)  { try { await setVol(v)  } catch { /* ignore */ } }

  async function handlePlaylistSelect(uri) {
    setSelectedUri(uri)
    if (!uri) return
    try { await playTrack(uri); setError('') } catch (e) { setError(e.message) }
  }

  function handleDisconnect() {
    disconnectPlayer()
    window.location.reload()
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-8">
      <div className="max-w-xl mx-auto flex flex-col gap-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SpotifyLogo size={28} />
            <h2 className="font-black text-white text-xl">Spotify</h2>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: '#0d1a0d', border: `1px solid ${SPOTIFY_GREEN}66`, color: SPOTIFY_GREEN }}>
            ✓ Connected
          </span>
        </div>

        {/* ── Device status ── */}
        {!isReady && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ backgroundColor: '#0d1a0d', border: `1px solid ${SPOTIFY_GREEN}33` }}>
            <div className="w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0"
              style={{ borderColor: SPOTIFY_GREEN, borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#9a8080' }}>Starting PracticePace player…</p>
          </div>
        )}

        {/* ── Now playing card ── */}
        <div className="flex items-center gap-5 p-5 rounded-3xl"
          style={{ backgroundColor: '#0d1a0d', border: `1px solid ${SPOTIFY_GREEN}33` }}>
          {/* Album art */}
          <div className="w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: '#1a2a1a' }}>
            {currentTrack?.art
              ? <img src={currentTrack.art} alt="Album art" className="w-full h-full object-cover" />
              : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1db95455" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3"/>
                  <line x1="12" y1="2" x2="12" y2="6"/>
                  <line x1="12" y1="18" x2="12" y2="22"/>
                  <line x1="2" y1="12" x2="6" y2="12"/>
                  <line x1="18" y1="12" x2="22" y2="12"/>
                </svg>
            }
          </div>
          {/* Track info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-base truncate">
              {currentTrack?.name ?? (isReady ? 'No track playing' : 'Waiting…')}
            </p>
            <p className="text-sm truncate mt-1" style={{ color: '#9a8080' }}>
              {currentTrack?.artist ?? '—'}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-2 h-2 rounded-full"
                style={{ backgroundColor: isReady ? SPOTIFY_GREEN : '#4a4a00' }} />
              <span className="text-xs font-semibold"
                style={{ color: isReady ? SPOTIFY_GREEN : '#9a8040' }}>
                {isReady ? 'Ready' : 'Connecting…'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Transport controls ── */}
        <div className="flex items-center justify-center gap-6">
          <button onClick={handlePrevious} disabled={!isReady}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
            style={{ backgroundColor: '#1a2a1a', color: '#fff' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19 20 9 12 19 4 19 20"/>
              <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          <button onClick={handlePlayPause} disabled={!isReady && !snap.deviceId}
            className="w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
            style={{ backgroundColor: SPOTIFY_GREEN, boxShadow: `0 0 36px ${SPOTIFY_GREEN}55` }}>
            {isPlaying ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 4 }}>
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            )}
          </button>

          <button onClick={handleNext} disabled={!isReady}
            className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
            style={{ backgroundColor: '#1a2a1a', color: '#fff' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4"/>
              <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Volume ── */}
        <div className="flex items-center gap-4 px-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9a8080" strokeWidth="2" strokeLinecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          </svg>
          <input type="range" min={0} max={100} value={snap.volume}
            onChange={e => handleVolume(Number(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${SPOTIFY_GREEN} ${snap.volume}%, #2a1a1a ${snap.volume}%)`,
              accentColor: SPOTIFY_GREEN,
            }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9a8080" strokeWidth="2" strokeLinecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        </div>

        {/* ── Playlist selector ── */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-widest" style={{ color: '#9a8080' }}>
            Play a Playlist
          </label>
          {loadingLists ? (
            <div className="flex items-center gap-2 py-3">
              <div className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{ borderColor: SPOTIFY_GREEN, borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: '#9a8080' }}>Loading playlists…</p>
            </div>
          ) : (
            <select value={selectedUri} onChange={e => handlePlaylistSelect(e.target.value)}
              className="rounded-2xl px-5 py-4 text-sm font-semibold outline-none"
              style={{ backgroundColor: '#110000', border: `1px solid ${SPOTIFY_GREEN}33`, color: '#fff' }}>
              <option value="">— Choose a playlist —</option>
              {playlists.map(p => (
                <option key={p.id} value={p.uri}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <p className="text-xs px-4 py-3 rounded-2xl" style={{ backgroundColor: '#2a0000', color: '#ff6666' }}>
            {error}
          </p>
        )}

        {/* ── Disconnect ── */}
        <div className="flex justify-center pt-2">
          <button onClick={handleDisconnect}
            className="text-xs underline transition-opacity hover:opacity-60"
            style={{ color: '#6a3030' }}>
            Disconnect Spotify
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Not connected screen ──────────────────────────────────────────────────────
function ConnectScreen() {
  const [connecting, setConnecting] = useState(false)

  async function handleConnect() {
    setConnecting(true)
    try {
      const url = await getAuthUrl()
      window.location.href = url
    } catch (e) {
      alert('Could not generate Spotify auth URL: ' + e.message)
      setConnecting(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-8 max-w-sm w-full text-center">

        <SpotifyLogo size={64} />

        <div className="flex flex-col gap-2">
          <h2 className="font-black text-white text-2xl">Connect Spotify</h2>
          <p className="text-sm leading-relaxed" style={{ color: '#9a8080' }}>
            Control your music during practice without leaving the app. Play playlists, skip tracks, and adjust volume — all from the Music tab.
          </p>
          <p className="text-xs font-semibold mt-1" style={{ color: '#6a4040' }}>
            Requires Spotify Premium
          </p>
        </div>

        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-bold text-white transition-all disabled:opacity-60 active:scale-95"
          style={{ backgroundColor: SPOTIFY_GREEN, boxShadow: `0 0 32px ${SPOTIFY_GREEN}44` }}
        >
          {connecting ? (
            <>
              <div className="w-5 h-5 rounded-full border-2 animate-spin"
                style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
              Redirecting to Spotify…
            </>
          ) : (
            <>
              <SpotifyLogo size={22} />
              Connect Spotify
            </>
          )}
        </button>

      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AudioSection({ orgColor }) {
  const [connected] = useState(() => isConnected())
  return connected ? <SpotifyPlayer orgColor={orgColor} /> : <ConnectScreen />
}
