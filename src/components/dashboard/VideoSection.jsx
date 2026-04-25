import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getGuestVideos, addGuestVideo, deleteGuestVideo } from '../../lib/guestStorage'

// ── URL detection ─────────────────────────────────────────────────────────────
function getVideoInfo(rawUrl) {
  const url = rawUrl?.trim() ?? ''

  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  if (yt) return { type: 'youtube', id: yt[1], embedUrl: `https://www.youtube.com/embed/${yt[1]}?autoplay=1`, thumbUrl: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` }

  // Vimeo
  const vim = url.match(/vimeo\.com\/(\d+)/)
  if (vim) return { type: 'vimeo', id: vim[1], embedUrl: `https://player.vimeo.com/video/${vim[1]}?autoplay=1`, thumbUrl: null }

  // All others (Hudl, generic links, etc.) — open in browser
  return { type: 'external', id: null, embedUrl: null, thumbUrl: null }
}

export default function VideoSection({ orgId, orgColor, isGuest }) {
  const [videos, setVideos]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [title, setTitle]         = useState('')
  const [url, setUrl]             = useState('')
  const [adding, setAdding]       = useState(false)
  const [error, setError]         = useState('')
  const [playingId, setPlayingId] = useState(null)
  const [deleteId, setDeleteId]   = useState(null)

  useEffect(() => {
    if (isGuest) {
      setVideos(getGuestVideos())
      setLoading(false)
    } else if (orgId) {
      load()
    } else {
      setLoading(false)
    }
  }, [orgId, isGuest])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('videos')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
      if (err) {
        // Show a helpful message if the table doesn't exist yet
        setError(
          err.message?.includes('does not exist') || err.code === '42P01'
            ? 'Videos table not found. Run the schema update in Supabase to enable this feature.'
            : `Could not load videos: ${err.message}`
        )
      }
      setVideos(data ?? [])
    } catch (e) {
      setError('Failed to load videos.')
    } finally {
      setLoading(false)
    }
  }

  async function addVideo(e) {
    e.preventDefault()
    if (!title.trim() || !url.trim()) { setError('Title and URL are required.'); return }
    setAdding(true); setError('')

    if (isGuest) {
      addGuestVideo({ title: title.trim(), url: url.trim() })
      setVideos(getGuestVideos())
      setTitle(''); setUrl(''); setAdding(false)
      return
    }

    try {
      const { error: err } = await supabase.from('videos').insert({
        org_id: orgId,
        title:  title.trim(),
        url:    url.trim(),
      })
      if (err) { setError(err.message); setAdding(false); return }
      setTitle(''); setUrl('')
      await load()
    } catch (e) {
      setError('Failed to save video.')
    } finally {
      setAdding(false)
    }
  }

  async function deleteVideo() {
    if (isGuest) {
      deleteGuestVideo(deleteId)
      setVideos(getGuestVideos())
    } else {
      await supabase.from('videos').delete().eq('id', deleteId)
    }
    if (playingId === deleteId) setPlayingId(null)
    setDeleteId(null)
    if (!isGuest) load()
  }

  const inputStyle = { backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#fff' }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-5">

        <h2 className="font-black text-white text-lg">Video Library</h2>

        {/* Add form */}
        <form
          onSubmit={addVideo}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 p-5 rounded-2xl"
          style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9a8080' }}>
              Video Title
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Film Session — Week 3"
              className="rounded-xl px-4 py-3 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9a8080' }}>
              Paste link from Hudl, YouTube, Vimeo, or any video URL
            </label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://hudl.com/… or https://youtu.be/…"
              className="rounded-xl px-4 py-3 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div className="flex flex-col justify-end gap-1.5">
            {error && <p className="text-xs" style={{ color: '#ff6666' }}>{error}</p>}
            <button
              type="submit"
              disabled={adding}
              className="py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: orgColor }}
            >
              {adding ? 'Adding…' : '+ Add Video'}
            </button>
          </div>
        </form>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: orgColor, borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#9a8080' }}>Loading videos…</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <div style={{ fontSize: 64, opacity: 0.1 }}>🎬</div>
            <p className="font-bold text-white mt-3 text-lg">No videos yet</p>
            <p className="text-sm mt-1" style={{ color: '#9a8080' }}>
              Paste a Hudl, YouTube, or Vimeo link above to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videos.map(v => {
              const info      = getVideoInfo(v.url)
              const isPlaying = playingId === v.id
              const canEmbed  = info.type === 'youtube' || info.type === 'vimeo'

              return (
                <div
                  key={v.id}
                  className="rounded-2xl overflow-hidden flex flex-col"
                  style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000' }}
                >
                  {/* Player / thumbnail */}
                  {isPlaying && canEmbed ? (
                    <div style={{ aspectRatio: '16/9' }}>
                      <iframe
                        src={info.embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={v.title}
                      />
                    </div>
                  ) : info.type === 'youtube' ? (
                    <button
                      onClick={() => setPlayingId(v.id)}
                      className="w-full relative block"
                      style={{ aspectRatio: '16/9', backgroundColor: '#0d0000' }}
                    >
                      <img
                        src={info.thumbUrl}
                        alt={v.title}
                        className="w-full h-full object-cover"
                        style={{ opacity: 0.5 }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="w-20 h-20 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: orgColor, boxShadow: `0 0 40px ${orgColor}66` }}
                        >
                          <span className="text-white text-3xl" style={{ marginLeft: 5 }}>▶</span>
                        </div>
                      </div>
                    </button>
                  ) : info.type === 'vimeo' ? (
                    <button
                      onClick={() => setPlayingId(v.id)}
                      className="w-full relative flex items-center justify-center"
                      style={{ aspectRatio: '16/9', backgroundColor: '#1ab7ea22' }}
                    >
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: '#1ab7ea', boxShadow: '0 0 40px #1ab7ea66' }}
                      >
                        <span className="text-white text-3xl" style={{ marginLeft: 5 }}>▶</span>
                      </div>
                      <span className="absolute bottom-3 right-3 text-xs font-bold px-2 py-1 rounded"
                        style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: '#1ab7ea' }}>
                        Vimeo
                      </span>
                    </button>
                  ) : (
                    /* External / Hudl — can't embed, show open-in-browser */
                    <div
                      className="flex flex-col items-center justify-center gap-3 p-6"
                      style={{ aspectRatio: '16/9', backgroundColor: '#0d0000' }}
                    >
                      <span style={{ fontSize: 40, opacity: 0.25 }}>🎬</span>
                      <p className="text-xs text-center font-semibold" style={{ color: '#9a8080' }}>
                        {new URL(v.url).hostname.replace('www.', '')}
                      </p>
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-lg text-sm font-bold"
                        style={{ backgroundColor: `${orgColor}22`, border: `1px solid ${orgColor}`, color: orgColor }}
                      >
                        Open in Browser ↗
                      </a>
                    </div>
                  )}

                  {/* Info row */}
                  <div className="flex items-center gap-2 px-4 py-3">
                    <p className="font-bold text-white text-sm truncate flex-1">{v.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {canEmbed && !isPlaying && (
                        <button
                          onClick={() => setPlayingId(v.id)}
                          className="text-xs font-bold px-3 py-2 rounded-lg"
                          style={{ backgroundColor: `${orgColor}22`, color: orgColor, border: `1px solid ${orgColor}` }}
                        >
                          ▶ Play
                        </button>
                      )}
                      {isPlaying && (
                        <button
                          onClick={() => setPlayingId(null)}
                          className="text-xs font-bold px-3 py-2 rounded-lg"
                          style={{ border: '1px solid #2a0000', color: '#9a8080' }}
                        >
                          ✕ Close
                        </button>
                      )}
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold px-3 py-2 rounded-lg"
                        style={{ border: '1px solid #2a0000', color: '#9a8080' }}
                      >
                        ↗
                      </a>
                      <button
                        onClick={() => setDeleteId(v.id)}
                        className="text-xs px-3 py-2 rounded-lg"
                        style={{ border: '1px solid #2a0000', color: '#6a3030' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
            style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
            <h3 className="font-bold text-white text-lg">Delete video?</h3>
            <p className="text-sm" style={{ color: '#9a8080' }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ border: '1px solid #2a0000', color: '#9a8080' }}>
                Cancel
              </button>
              <button onClick={deleteVideo}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: '#cc1111' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
