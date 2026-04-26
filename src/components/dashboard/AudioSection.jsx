import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  subscribe as subscribeAudio, getSnapshot as getAudioSnapshot,
  playSongAtIndex, togglePlay, playNext, playPrev,
  setVolume as setAudioVolume, setShuffle, setLoop, setPlaylist, seek,
} from '../../lib/audioPlayer'
import { getAuthUrl, getPlaylists } from '../../lib/spotify'
import {
  subscribe as subscribeSpotify, getSnapshot as getSpotifySnapshot,
  setupSpotifySDK, refreshDevices, selectDevice,
  playTrack, pauseTrack, nextTrack, prevTrack, setVol as setSpotifyVol,
  disconnectPlayer, isConnected as spotifyIsConnected, startPolling,
} from '../../lib/spotifyPlayer'

const BUCKET      = 'music'
const PLAYLIST_KEY = 'pp_spotify_playlist'

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDuration(secs) {
  if (!secs || isNaN(secs)) return '—'
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function cleanName(filename) {
  return filename
    .replace(/\.(mp3|m4a|aac|wav|ogg|flac)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function measureDuration(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const a   = new Audio(url)
    a.addEventListener('loadedmetadata', () => { URL.revokeObjectURL(url); resolve(Math.round(a.duration)) })
    a.addEventListener('error',          () => { URL.revokeObjectURL(url); resolve(null) })
  })
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

const PlayIcon     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const PauseIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
const SkipBack     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const SkipFwd      = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const ShuffleIcon  = () => <svg width="16" height="16" viewBox="0 0 24 24" {...S}><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
const LoopIcon     = () => <svg width="16" height="16" viewBox="0 0 24 24" {...S}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
const UploadIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" {...S}><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
const TrashIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" {...S}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const DragHandle   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6a4040" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
const SpotifyLogo  = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#1db954">
    <circle cx="12" cy="12" r="12"/>
    <path d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15C9.65 6.8 15.6 7 19.35 9.2c.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25m-.1 2.8c-.25.4-.75.5-1.15.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.4.25.5.75.3 1m-1.3 2.8c-.2.35-.65.45-1 .25-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.35.15.4.65.4 1" fill="white"/>
  </svg>
)

// ── MP3 Player Controls (always visible when a song is loaded) ────────────────
function PlayerControls({ snap, currentTime, orgColor }) {
  const { song, isPlaying, volume, shuffle, loop, duration } = snap
  const pct  = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleSeek = e => {
    const rect  = e.currentTarget.getBoundingClientRect()
    const frac  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(frac * duration)
  }

  return (
    <div className="flex flex-col gap-3 px-5 pt-5 pb-4 rounded-3xl"
      style={{ backgroundColor: '#0d0800', border: `1px solid ${orgColor}33` }}>

      {/* Song name */}
      <div className="min-w-0">
        <p className="font-bold text-white text-base truncate leading-tight">
          {song?.name ?? 'No song selected'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#9a8080' }}>
          {song ? formatDuration(duration) : '—'}
        </p>
      </div>

      {/* Progress bar */}
      <div
        className="relative h-2 rounded-full cursor-pointer"
        style={{ backgroundColor: '#2a1a00' }}
        onClick={handleSeek}
      >
        <div className="absolute left-0 top-0 h-full rounded-full transition-none"
          style={{ width: `${pct}%`, backgroundColor: orgColor }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white"
          style={{ left: `calc(${pct}% - 6px)`, backgroundColor: orgColor }}
        />
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-xs" style={{ color: '#6a4040', marginTop: -8 }}>
        <span>{formatDuration(currentTime)}</span>
        <span>{formatDuration(duration)}</span>
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-5">
        {/* Shuffle */}
        <button
          onClick={() => setShuffle(!shuffle)}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ color: shuffle ? orgColor : '#4a3030', backgroundColor: shuffle ? `${orgColor}22` : 'transparent' }}
          title="Shuffle"
        >
          <ShuffleIcon />
        </button>

        {/* Prev */}
        <button
          onClick={playPrev}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ backgroundColor: '#1a1000', color: '#fff' }}
        >
          <SkipBack />
        </button>

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ backgroundColor: orgColor, boxShadow: `0 0 28px ${orgColor}55` }}
        >
          {isPlaying
            ? <PauseIcon />
            : <span style={{ marginLeft: 3 }}><PlayIcon /></span>
          }
        </button>

        {/* Next */}
        <button
          onClick={playNext}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ backgroundColor: '#1a1000', color: '#fff' }}
        >
          <SkipFwd />
        </button>

        {/* Loop */}
        <button
          onClick={() => setLoop(!loop)}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ color: loop ? orgColor : '#4a3030', backgroundColor: loop ? `${orgColor}22` : 'transparent' }}
          title="Loop playlist"
        >
          <LoopIcon />
        </button>

        {/* Volume inline mini */}
        <div className="flex items-center gap-1.5 w-20">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6a4040" strokeWidth="2" strokeLinecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          </svg>
          <input
            type="range" min={0} max={100} value={volume}
            onChange={e => setAudioVolume(Number(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${orgColor} ${volume}%, #2a1a00 ${volume}%)`,
              accentColor: orgColor,
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Library tab ───────────────────────────────────────────────────────────────
function LibraryTab({ songs, playingId, orgColor, orgId, onRefresh }) {
  const fileInputRef  = useRef(null)
  const [uploads,     setUploads]    = useState([])  // [{name, progress, error}]
  const [delConfirm,  setDelConfirm] = useState(null) // song id pending delete
  const [dragIdx,     setDragIdx]    = useState(null)
  const [dragOverIdx, setDragOverIdx]= useState(null)

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function handleFiles(e) {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('audio/') || /\.mp3$/i.test(f.name))
    if (!files.length) return
    e.target.value = ''

    // Init upload entries
    const entries = files.map(f => ({ name: f.name, progress: 0, error: null }))
    setUploads(entries)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const duration = await measureDuration(file)
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path     = `${orgId}/${Date.now()}_${safeName}`

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            onUploadProgress: ({ loaded, total }) => {
              const pct = Math.round((loaded / total) * 100)
              setUploads(prev => prev.map((u, j) => j === i ? { ...u, progress: pct } : u))
            },
          })
        if (uploadErr) throw uploadErr

        // Get current max position for this org
        const { data: maxRow } = await supabase
          .from('songs')
          .select('position')
          .eq('org_id', orgId)
          .order('position', { ascending: false })
          .limit(1)
          .maybeSingle()

        const nextPos = (maxRow?.position ?? -1) + 1

        const { error: insertErr } = await supabase.from('songs').insert({
          org_id:       orgId,
          name:         cleanName(file.name),
          storage_path: path,
          duration,
          position:     nextPos,
        })
        if (insertErr) throw insertErr

        setUploads(prev => prev.map((u, j) => j === i ? { ...u, progress: 100 } : u))
      } catch (err) {
        console.error('[AudioSection] Upload error:', err.message)
        setUploads(prev => prev.map((u, j) => j === i ? { ...u, error: err.message } : u))
      }
    }

    // Done — refresh song list
    await onRefresh()
    setTimeout(() => setUploads([]), 2000)
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(song) {
    try {
      await supabase.storage.from(BUCKET).remove([song.storage_path])
      await supabase.from('songs').delete().eq('id', song.id)
      setDelConfirm(null)
      await onRefresh()
    } catch (err) {
      console.error('[AudioSection] Delete error:', err.message)
    }
  }

  // ── Drag-to-reorder ─────────────────────────────────────────────────────────
  function onDragStart(idx) { setDragIdx(idx) }
  function onDragOver(e, idx) { e.preventDefault(); setDragOverIdx(idx) }

  async function onDrop(idx) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return }
    const reordered = [...songs]
    const [moved]   = reordered.splice(dragIdx, 1)
    reordered.splice(idx, 0, moved)
    setDragIdx(null)
    setDragOverIdx(null)
    await saveOrder(reordered)
  }

  async function saveOrder(ordered) {
    setPlaylist(ordered)
    await Promise.all(
      ordered.map((s, i) => supabase.from('songs').update({ position: i }).eq('id', s.id))
    )
    await onRefresh()
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-95"
        style={{ backgroundColor: '#1a0d00', border: `1px dashed ${orgColor}55`, color: orgColor }}
      >
        <UploadIcon /> Upload MP3 Files
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/m4a,audio/aac,audio/wav,audio/ogg,.mp3,.m4a,.aac,.wav"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="flex flex-col gap-2">
          {uploads.map((u, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs" style={{ color: u.error ? '#ff6666' : '#9a8080' }}>
                <span className="truncate max-w-[240px]">{cleanName(u.name)}</span>
                <span>{u.error ? 'Error' : u.progress === 100 ? '✓' : `${u.progress}%`}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#2a1a00' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${u.progress}%`,
                    backgroundColor: u.error ? '#cc3300' : orgColor,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Song list */}
      {songs.length === 0 && uploads.length === 0 ? (
        <div className="text-center py-10" style={{ color: '#6a4040' }}>
          <p className="text-sm">No songs uploaded yet.</p>
          <p className="text-xs mt-1">Tap "Upload MP3 Files" to add music for practice.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {songs.map((song, idx) => {
            const isActive = song.id === playingId
            const isDragOver = dragOverIdx === idx
            return (
              <div
                key={song.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={() => onDrop(idx)}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all select-none"
                style={{
                  backgroundColor: isActive ? `${orgColor}22` : isDragOver ? '#2a1500' : '#0d0800',
                  border: `1px solid ${isActive ? orgColor + '55' : isDragOver ? orgColor + '44' : '#2a1a0033'}`,
                  cursor: 'grab',
                }}
              >
                {/* Drag handle */}
                <span className="flex-shrink-0 cursor-grab opacity-40"><DragHandle /></span>

                {/* Song info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate leading-tight"
                    style={{ color: isActive ? orgColor : '#fff' }}>
                    {song.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#6a4040' }}>
                    {formatDuration(song.duration)}
                  </p>
                </div>

                {/* Play button */}
                <button
                  onClick={() => playSongAtIndex(idx)}
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                  style={{ backgroundColor: isActive ? orgColor : '#2a1200', color: '#fff' }}
                >
                  <PlayIcon />
                </button>

                {/* Delete */}
                {delConfirm === song.id ? (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleDelete(song)}
                      className="text-xs font-bold px-2 py-1 rounded-lg"
                      style={{ backgroundColor: '#cc2200', color: '#fff' }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDelConfirm(null)}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ backgroundColor: '#2a1200', color: '#9a8080' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDelConfirm(song.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 opacity-40 hover:opacity-100"
                    style={{ color: '#ff4444' }}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Playlist tab ──────────────────────────────────────────────────────────────
function PlaylistTab({ songs, currentIndex, orgColor, onReorder }) {
  const [dragIdx,     setDragIdx]     = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  async function onDrop(idx) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return }
    const reordered = [...songs]
    const [moved]   = reordered.splice(dragIdx, 1)
    reordered.splice(idx, 0, moved)
    setDragIdx(null)
    setDragOverIdx(null)
    await onReorder(reordered)
  }

  async function moveUp(idx) {
    if (idx === 0) return
    const reordered = [...songs]
    ;[reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]]
    await onReorder(reordered)
  }

  async function moveDown(idx) {
    if (idx === songs.length - 1) return
    const reordered = [...songs]
    ;[reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]]
    await onReorder(reordered)
  }

  if (songs.length === 0) {
    return (
      <div className="text-center py-10" style={{ color: '#6a4040' }}>
        <p className="text-sm">No songs in your practice playlist.</p>
        <p className="text-xs mt-1">Upload songs in the Library tab to build your playlist.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Play All */}
      <button
        onClick={() => playSongAtIndex(0)}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-95"
        style={{ backgroundColor: orgColor, color: '#fff', boxShadow: `0 0 20px ${orgColor}44` }}
      >
        <PlayIcon /> Play All from Start
      </button>

      <p className="text-xs text-center" style={{ color: '#6a4040' }}>
        Drag to reorder · tap ▲▼ on iPad
      </p>

      {/* Draggable + touch-friendly list */}
      <div className="flex flex-col gap-1">
        {songs.map((song, idx) => {
          const isActive   = idx === currentIndex
          const isDragOver = dragOverIdx === idx
          return (
            <div
              key={song.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); setDragOverIdx(idx) }}
              onDrop={() => onDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
              className="flex items-center gap-2 px-3 py-3 rounded-2xl transition-all select-none"
              style={{
                backgroundColor: isActive ? `${orgColor}22` : isDragOver ? '#2a1500' : '#0d0800',
                border: `1px solid ${isActive ? orgColor + '55' : isDragOver ? orgColor + '44' : '#2a1a0033'}`,
                cursor: 'grab',
              }}
            >
              {/* Position number */}
              <span className="text-xs font-bold w-5 text-center flex-shrink-0"
                style={{ color: isActive ? orgColor : '#4a3030' }}>
                {idx + 1}
              </span>

              {/* Drag handle (desktop) */}
              <span className="flex-shrink-0 opacity-30 hidden md:block"><DragHandle /></span>

              {/* Song info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: isActive ? orgColor : '#fff' }}>
                  {song.name}
                </p>
                <p className="text-xs" style={{ color: '#6a4040' }}>{formatDuration(song.duration)}</p>
              </div>

              {/* Touch-friendly up/down (primary on iPad) */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="w-6 h-6 rounded flex items-center justify-center text-xs disabled:opacity-20 active:scale-90"
                  style={{ backgroundColor: '#2a1200', color: '#9a8080' }}
                >▲</button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === songs.length - 1}
                  className="w-6 h-6 rounded flex items-center justify-center text-xs disabled:opacity-20 active:scale-90"
                  style={{ backgroundColor: '#2a1200', color: '#9a8080' }}
                >▼</button>
              </div>

              {/* Play button */}
              <button
                onClick={() => playSongAtIndex(idx)}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90"
                style={{ backgroundColor: isActive ? orgColor : '#2a1200', color: '#fff' }}
              >
                <PlayIcon />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── MP3 Player (primary section) ──────────────────────────────────────────────
function Mp3Player({ orgColor }) {
  const { profile } = useAuth()
  const orgId = profile?.org_id

  const [snap,        setSnap]       = useState(() => getAudioSnapshot())
  const [currentTime, setCurrentTime]= useState(0)
  const [songs,       setSongs]      = useState([])
  const [loading,     setLoading]    = useState(true)
  const [error,       setError]      = useState('')
  const [tab,         setTab]        = useState('library')  // 'library' | 'playlist'

  // Subscribe to audioPlayer
  useEffect(() => {
    return subscribeAudio((type, payload) => {
      if (type === 'state')    { setSnap({ ...payload }) }
      if (type === 'progress') { setCurrentTime(payload.currentTime) }
      if (type === 'error')    { setError(payload) }
    })
  }, [])

  // Load songs from Supabase
  const loadSongs = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    try {
      const { data, error: err } = await supabase
        .from('songs')
        .select('*')
        .eq('org_id', orgId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
      if (err) throw err
      const list = data ?? []
      setSongs(list)
      setPlaylist(list)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { loadSongs() }, [loadSongs])

  async function handleReorder(reordered) {
    setSongs(reordered)
    setPlaylist(reordered)
    await Promise.all(
      reordered.map((s, i) => supabase.from('songs').update({ position: i }).eq('id', s.id))
    )
    await loadSongs()
  }

  if (!orgId) {
    return (
      <div className="text-center py-10" style={{ color: '#9a8080' }}>
        <p className="text-sm">Sign in to an organization to use the music player.</p>
      </div>
    )
  }

  const playingId = snap.song?.id ?? null

  return (
    <div className="flex flex-col gap-4">

      {/* Player controls — always visible */}
      <PlayerControls snap={snap} currentTime={currentTime} orgColor={orgColor} />

      {/* Error */}
      {error && (
        <p className="text-xs px-4 py-3 rounded-2xl" style={{ backgroundColor: '#2a0000', color: '#ff6666' }}>
          {error}
        </p>
      )}

      {/* Sub-tabs */}
      <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #2a1a00' }}>
        {['library', 'playlist'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-sm font-bold capitalize transition-colors"
            style={{
              backgroundColor: tab === t ? orgColor : 'transparent',
              color: tab === t ? '#fff' : '#6a4040',
            }}
          >
            {t === 'library' ? '🎵 Library' : '📋 Playlist'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex items-center justify-center py-10 gap-3">
          <div className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: orgColor, borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#9a8080' }}>Loading songs…</p>
        </div>
      ) : tab === 'library' ? (
        <LibraryTab
          songs={songs}
          playingId={playingId}
          orgColor={orgColor}
          orgId={orgId}
          onRefresh={loadSongs}
        />
      ) : (
        <PlaylistTab
          songs={songs}
          currentIndex={snap.currentIndex}
          orgColor={orgColor}
          onReorder={handleReorder}
        />
      )}
    </div>
  )
}

// ── Spotify section (secondary) ───────────────────────────────────────────────
function SpotifySection({ orgColor }) {
  const [connected, setConnected] = useState(() => spotifyIsConnected())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (spotifyIsConnected() && !connected) setConnected(true)
  }, [])

  return (
    <div className="flex flex-col gap-3 pt-2">
      {/* Divider + toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-3 w-full py-2"
      >
        <div className="flex-1 h-px" style={{ backgroundColor: '#2a1a00' }} />
        <div className="flex items-center gap-2">
          <SpotifyLogo size={16} />
          <span className="text-xs font-bold" style={{ color: '#9a8080' }}>
            Spotify Connect {open ? '▲' : '▼'}
          </span>
        </div>
        <div className="flex-1 h-px" style={{ backgroundColor: '#2a1a00' }} />
      </button>

      {open && (
        connected ? <SpotifyPlayer /> : <SpotifyConnectScreen />
      )}
    </div>
  )
}

// ── Spotify player sub-component ──────────────────────────────────────────────
function SpotifyPlayer() {
  const SPOTIFY_GREEN  = '#1db954'
  const [snap,          setSnap]          = useState(() => getSpotifySnapshot())
  const [playlists,     setPlaylists]     = useState([])
  const [selectedUri,   setSelectedUri]   = useState(() => localStorage.getItem(PLAYLIST_KEY) ?? '')
  const [loadingLists,  setLoadingLists]  = useState(true)
  const [loadingDevs,   setLoadingDevs]   = useState(false)
  const [showDevPicker, setShowDevPicker] = useState(false)
  const [error,         setError]         = useState('')

  const { sdkReady, sdkFailed, sdkLoading, deviceId, devices, isPlaying, currentTrack } = snap

  useEffect(() => {
    setupSpotifySDK().catch(() => {})
    startPolling()
    return subscribeSpotify((type, payload) => {
      if (type === 'state') setSnap({ ...payload })
      if (type === 'error') setError(payload)
    })
  }, [])

  async function fetchPlaylists() {
    setLoadingLists(true)
    setError('')
    try {
      const list  = await getPlaylists()
      const valid = (list ?? []).filter(p => p && p.id && p.name)
      setPlaylists(valid)
    } catch (e) { setError(e.message) }
    finally { setLoadingLists(false) }
  }

  useEffect(() => { fetchPlaylists() }, [])

  useEffect(() => {
    if (sdkFailed) { setShowDevPicker(true); handleRefreshDevices() }
  }, [sdkFailed])

  async function handleRefreshDevices() {
    setLoadingDevs(true)
    try { await refreshDevices() } catch (e) { setError(e.message) }
    finally { setLoadingDevs(false) }
  }

  async function handlePlayPause() {
    try {
      if (isPlaying) await pauseTrack()
      else           await playTrack(selectedUri || undefined)
      setError('')
    } catch (e) { setError(e.message) }
  }

  async function handlePlaylistSelect(uri) {
    setSelectedUri(uri)
    if (uri) localStorage.setItem(PLAYLIST_KEY, uri)
    else     localStorage.removeItem(PLAYLIST_KEY)
    if (!uri) return
    try { await playTrack(uri); setError('') } catch (e) { setError(e.message) }
  }

  function handleDisconnect() {
    localStorage.removeItem(PLAYLIST_KEY)
    disconnectPlayer()
    window.location.reload()
  }

  const isReady = sdkReady || (!sdkLoading && !!deviceId)

  return (
    <div className="flex flex-col gap-4">

      {/* Status */}
      {sdkLoading && !sdkFailed && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ backgroundColor: '#0d1a0d', border: `1px solid ${SPOTIFY_GREEN}33` }}>
          <div className="w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0"
            style={{ borderColor: SPOTIFY_GREEN, borderTopColor: 'transparent' }} />
          <p className="text-sm font-semibold" style={{ color: SPOTIFY_GREEN }}>
            Starting Spotify player…
          </p>
        </div>
      )}

      {sdkReady && (
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl"
          style={{ backgroundColor: '#0d1a0d', border: `1px solid ${SPOTIFY_GREEN}33` }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SPOTIFY_GREEN }} />
            <p className="text-sm font-semibold" style={{ color: SPOTIFY_GREEN }}>PracticePace player ready</p>
          </div>
          <button onClick={() => { setShowDevPicker(v => !v); if (!showDevPicker) handleRefreshDevices() }}
            className="text-xs underline" style={{ color: '#9a8080' }}>
            {showDevPicker ? 'Hide devices' : 'Use external device'}
          </button>
        </div>
      )}

      {sdkFailed && (
        <div className="px-4 py-3 rounded-2xl" style={{ backgroundColor: '#1a0d00', border: '1px solid #3a2000' }}>
          <p className="text-sm font-semibold" style={{ color: '#ffaa00' }}>
            Select a Spotify device below to play music
          </p>
          <p className="text-xs mt-1" style={{ color: '#9a8080' }}>
            For best results on iPad, use Chrome browser. Open Spotify on your phone or another device, then select it below to control music from PracticePace.
          </p>
        </div>
      )}

      {/* Device picker */}
      {(showDevPicker || sdkFailed) && (
        <div className="flex flex-col gap-3 p-4 rounded-2xl"
          style={{ backgroundColor: '#0d1a0d', border: `1px solid ${SPOTIFY_GREEN}33` }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#9a8080' }}>
              External Devices
            </p>
            <button onClick={handleRefreshDevices} disabled={loadingDevs}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl disabled:opacity-50"
              style={{ backgroundColor: '#1a2a1a', color: SPOTIFY_GREEN }}>
              {loadingDevs ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {devices.length === 0
            ? <p className="text-sm" style={{ color: '#9a8080' }}>
                No devices found — open Spotify on your phone or laptop.
              </p>
            : devices.map(device => (
                <button key={device.id} onClick={() => selectDevice(device.id)}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
                  style={{
                    backgroundColor: device.id === deviceId ? '#1a3a1a' : '#0a1a0a',
                    border: `1px solid ${device.id === deviceId ? SPOTIFY_GREEN : SPOTIFY_GREEN + '22'}`,
                  }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: device.id === deviceId ? SPOTIFY_GREEN : '#4a4a4a' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{device.name}</p>
                    <p className="text-xs" style={{ color: '#9a8080' }}>{device.type}</p>
                  </div>
                  {device.id === deviceId && (
                    <span className="text-xs font-bold" style={{ color: SPOTIFY_GREEN }}>Selected</span>
                  )}
                </button>
              ))
          }
        </div>
      )}

      {/* Now playing */}
      <div className="flex items-center gap-4 p-4 rounded-2xl"
        style={{ backgroundColor: '#0d1a0d', border: `1px solid ${SPOTIFY_GREEN}33` }}>
        <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: '#1a2a1a' }}>
          {currentTrack?.art
            ? <img src={currentTrack.art} alt="Album art" className="w-full h-full object-cover" />
            : <div className="w-full h-full" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate">{currentTrack?.name ?? 'Nothing playing'}</p>
          <p className="text-xs truncate mt-0.5" style={{ color: '#9a8080' }}>{currentTrack?.artist ?? '—'}</p>
          {isReady && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isPlaying ? SPOTIFY_GREEN : '#4a4a00' }} />
              <span className="text-xs font-semibold" style={{ color: isPlaying ? SPOTIFY_GREEN : '#9a8040' }}>
                {isPlaying ? 'Playing' : 'Ready'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-5">
        <button onClick={() => prevTrack().catch(() => {})} disabled={!isReady}
          className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30"
          style={{ backgroundColor: '#0d1a0d', color: '#fff' }}>
          <SkipBack />
        </button>
        <button onClick={handlePlayPause} disabled={!isReady}
          className="w-16 h-16 rounded-full flex items-center justify-center disabled:opacity-30 active:scale-90"
          style={{ backgroundColor: SPOTIFY_GREEN, boxShadow: `0 0 24px ${SPOTIFY_GREEN}55` }}>
          {isPlaying ? <PauseIcon /> : <span style={{ marginLeft: 3 }}><PlayIcon /></span>}
        </button>
        <button onClick={() => nextTrack().catch(() => {})} disabled={!isReady}
          className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30"
          style={{ backgroundColor: '#0d1a0d', color: '#fff' }}>
          <SkipFwd />
        </button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-3 px-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9a8080" strokeWidth="2" strokeLinecap="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        </svg>
        <input type="range" min={0} max={100} value={snap.volume}
          onChange={e => setSpotifyVol(Number(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${SPOTIFY_GREEN} ${snap.volume}%, #1a2a1a ${snap.volume}%)`,
            accentColor: SPOTIFY_GREEN,
          }}
        />
      </div>

      {/* Playlist picker */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest" style={{ color: '#9a8080' }}>
            Play a Playlist
          </label>
          <button onClick={fetchPlaylists} disabled={loadingLists}
            className="text-xs font-semibold px-3 py-1 rounded-xl disabled:opacity-50"
            style={{ backgroundColor: '#1a2a1a', color: SPOTIFY_GREEN }}>
            {loadingLists ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <select
          value={selectedUri}
          onChange={e => handlePlaylistSelect(e.target.value)}
          disabled={!isReady}
          className="rounded-2xl px-4 py-3 text-sm font-semibold outline-none disabled:opacity-40"
          style={{ backgroundColor: '#110000', border: `1px solid ${SPOTIFY_GREEN}33`, color: '#fff' }}>
          <option value="">— Choose a playlist —</option>
          {playlists.map(p => <option key={p.id} value={p.uri}>{p.name}</option>)}
        </select>
      </div>

      {error && (
        <p className="text-xs px-4 py-3 rounded-2xl" style={{ backgroundColor: '#2a0000', color: '#ff6666' }}>
          {error}
        </p>
      )}

      <div className="flex justify-center">
        <button onClick={handleDisconnect}
          className="text-xs underline opacity-40 hover:opacity-70"
          style={{ color: '#9a8080' }}>
          Disconnect Spotify
        </button>
      </div>
    </div>
  )
}

function SpotifyConnectScreen() {
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
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <SpotifyLogo size={48} />
      <div>
        <h3 className="font-bold text-white text-lg">Connect Spotify</h3>
        <p className="text-sm mt-1" style={{ color: '#9a8080' }}>
          Control Spotify on an external device (phone or laptop) from PracticePace.
          Requires Spotify Premium.
        </p>
      </div>
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white text-sm transition-all disabled:opacity-60 active:scale-95"
        style={{ backgroundColor: '#1db954' }}>
        {connecting ? 'Redirecting…' : <><SpotifyLogo size={18} /> Connect Spotify</>}
      </button>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AudioSection({ orgColor }) {
  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-8">
      <div className="max-w-xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={orgColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
          <h2 className="font-black text-white text-xl">Music</h2>
        </div>

        {/* Primary: MP3 player */}
        <Mp3Player orgColor={orgColor} />

        {/* Secondary: Spotify Connect */}
        <SpotifySection orgColor={orgColor} />

      </div>
    </div>
  )
}
