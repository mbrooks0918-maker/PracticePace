import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function getYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

export default function VideoSection({ orgId, orgColor }) {
  const [videos, setVideos]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [title, setTitle]       = useState('')
  const [url, setUrl]           = useState('')
  const [adding, setAdding]     = useState(false)
  const [error, setError]       = useState('')
  const [playingId, setPlayingId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => { if (orgId) load(); else setLoading(false) }, [orgId])

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('videos')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
    if (err) setError('videos table not found — see README to create it.')
    setVideos(data ?? [])
    setLoading(false)
  }

  async function addVideo(e) {
    e.preventDefault()
    if (!title.trim() || !url.trim()) { setError('Title and URL are required.'); return }
    setAdding(true); setError('')
    const { error: err } = await supabase.from('videos').insert({
      org_id: orgId,
      title: title.trim(),
      url: url.trim(),
    })
    if (err) { setError(err.message); setAdding(false); return }
    setTitle(''); setUrl(''); setAdding(false)
    load()
  }

  async function deleteVideo() {
    await supabase.from('videos').delete().eq('id', deleteId)
    if (playingId === deleteId) setPlayingId(null)
    setDeleteId(null)
    load()
  }

  const inputStyle = { backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#fff' }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <h2 className="font-bold text-white text-base">Video Library</h2>

        {/* Add form */}
        <form onSubmit={addVideo} className="flex flex-col gap-3 p-4 rounded-2xl" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9a8080' }}>Add Video</p>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Video title…"
            className="rounded-lg px-4 py-2.5 text-sm outline-none" style={inputStyle} />
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="YouTube URL (e.g. https://youtu.be/…)"
            className="rounded-lg px-4 py-2.5 text-sm outline-none" style={inputStyle} />
          {error && <p className="text-xs" style={{ color: '#ff6666' }}>{error}</p>}
          <button type="submit" disabled={adding}
            className="py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: orgColor }}>
            {adding ? 'Adding…' : '+ Add Video'}
          </button>
        </form>

        {/* List */}
        {loading ? (
          <p className="text-center text-sm py-8" style={{ color: '#9a8080' }}>Loading…</p>
        ) : videos.length === 0 ? (
          <div className="text-center py-16">
            <div style={{ fontSize: 52, opacity: 0.12 }}>🎬</div>
            <p className="font-bold text-white mt-2">No videos yet</p>
            <p className="text-sm mt-1" style={{ color: '#9a8080' }}>Add a YouTube link above to get started.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {videos.map(v => {
              const ytId     = getYouTubeId(v.url)
              const isPlaying = playingId === v.id

              return (
                <div key={v.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000' }}>
                  {/* YouTube player */}
                  {isPlaying && ytId && (
                    <div style={{ aspectRatio: '16/9' }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={v.title}
                      />
                    </div>
                  )}

                  {/* Thumbnail */}
                  {!isPlaying && ytId && (
                    <button
                      onClick={() => setPlayingId(v.id)}
                      className="w-full relative"
                      style={{ aspectRatio: '16/9', backgroundColor: '#0d0000', display: 'block' }}
                    >
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                        alt={v.title}
                        className="w-full h-full object-cover"
                        style={{ opacity: 0.55 }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: orgColor }}>
                          <span className="text-white text-2xl" style={{ marginLeft: 4 }}>▶</span>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Non-YouTube placeholder */}
                  {!ytId && (
                    <div className="flex items-center justify-center" style={{ aspectRatio: '16/9', backgroundColor: '#0d0000' }}>
                      <span style={{ fontSize: 40, opacity: 0.2 }}>🎬</span>
                    </div>
                  )}

                  {/* Controls row */}
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <p className="font-semibold text-white text-sm truncate flex-1">{v.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {ytId && !isPlaying && (
                        <button onClick={() => setPlayingId(v.id)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg"
                          style={{ backgroundColor: `${orgColor}22`, color: orgColor, border: `1px solid ${orgColor}` }}>
                          ▶ Play
                        </button>
                      )}
                      {isPlaying && (
                        <button onClick={() => setPlayingId(null)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg"
                          style={{ border: '1px solid #2a0000', color: '#9a8080' }}>✕ Close</button>
                      )}
                      <a href={v.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={{ border: '1px solid #2a0000', color: '#9a8080' }}>↗ Open</a>
                      <button onClick={() => setDeleteId(v.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg"
                        style={{ border: '1px solid #2a0000', color: '#9a8080' }}>✕</button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
            <h3 className="font-bold text-white text-lg">Delete video?</h3>
            <p className="text-sm" style={{ color: '#9a8080' }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ border: '1px solid #2a0000', color: '#9a8080' }}>Cancel</button>
              <button onClick={deleteVideo} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: '#cc1111' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
