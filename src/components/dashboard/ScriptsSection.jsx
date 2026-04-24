import { useState } from 'react'
import { supabase } from '../../lib/supabase'

function pad(n) { return String(n).padStart(2, '0') }
function fmt(s) { return `${pad(Math.floor(s / 60))}:${pad(s % 60)}` }

const SPORTS = ['Football','Basketball','Volleyball','Baseball','Softball','Soccer','Track','Wrestling','Tennis','Other']

// ── Create Script Modal ───────────────────────────────────────────────────────
function CreateModal({ orgId, userId, orgColor, onClose, onCreated }) {
  const [name, setName]   = useState('')
  const [sport, setSport] = useState('Football')
  const [drills, setDrills] = useState([{ name: '', duration: 300 }])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function addDrill() {
    setDrills(d => [...d, { name: '', duration: 300 }])
  }
  function removeDrill(i) {
    setDrills(d => d.filter((_, idx) => idx !== i))
  }
  function updateDrill(i, key, value) {
    setDrills(d => d.map((drill, idx) => idx === i ? { ...drill, [key]: value } : drill))
  }
  function drillMins(i)  { return Math.floor(drills[i].duration / 60) }
  function drillSecs2(i) { return drills[i].duration % 60 }
  function setMins(i, v) { updateDrill(i, 'duration', Number(v) * 60 + drillSecs2(i)) }
  function setSecs(i, v) { updateDrill(i, 'duration', drillMins(i) * 60 + Math.min(59, Number(v))) }

  async function save() {
    if (!name.trim()) { setError('Script name is required.'); return }
    if (drills.some(d => !d.name.trim())) { setError('Every drill needs a name.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('scripts').insert({
      org_id: orgId,
      created_by: userId,
      name: name.trim(),
      sport,
      drills: drills.map(d => ({ name: d.name.trim(), duration: Number(d.duration) || 60 })),
    })
    if (err) { setError(err.message); setSaving(false); return }
    onCreated()
    onClose()
  }

  const inputStyle = { backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#fff' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[92vh]" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #2a0000' }}>
          <h2 className="font-bold text-white text-lg">New Script</h2>
          <button onClick={onClose} className="text-xl" style={{ color: '#9a8080' }}>✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>Script Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Monday Offense"
              className="rounded-lg px-4 py-2.5 text-sm outline-none" style={inputStyle} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>Sport</label>
            <select value={sport} onChange={e => setSport(e.target.value)}
              className="rounded-lg px-4 py-2.5 text-sm outline-none" style={inputStyle}>
              {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Drills */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>Drills</label>
              <button onClick={addDrill} className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: `${orgColor}22`, color: orgColor, border: `1px solid ${orgColor}` }}>
                + Add Drill
              </button>
            </div>

            {drills.map((drill, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 flex flex-col gap-1.5">
                  <input value={drill.name} onChange={e => updateDrill(i, 'name', e.target.value)}
                    placeholder={`Drill ${i + 1} name`}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
                  <div className="flex items-center gap-1.5">
                    <input type="number" value={drillMins(i)} min={0} onChange={e => setMins(i, e.target.value)}
                      className="w-14 rounded-lg px-2 py-1.5 text-sm text-center outline-none" style={inputStyle} />
                    <span className="text-xs" style={{ color: '#9a8080' }}>min</span>
                    <input type="number" value={drillSecs2(i)} min={0} max={59} onChange={e => setSecs(i, e.target.value)}
                      className="w-14 rounded-lg px-2 py-1.5 text-sm text-center outline-none" style={inputStyle} />
                    <span className="text-xs" style={{ color: '#9a8080' }}>sec</span>
                    <span className="text-xs ml-1" style={{ color: '#4a2020' }}>= {fmt(drill.duration)}</span>
                  </div>
                </div>
                {drills.length > 1 && (
                  <button onClick={() => removeDrill(i)} className="mt-1.5 px-2 py-2 rounded-lg text-sm"
                    style={{ color: '#9a8080', border: '1px solid #2a0000' }}>✕</button>
                )}
              </div>
            ))}
          </div>

          {error && (
            <p className="text-xs text-center rounded-lg px-3 py-2" style={{ backgroundColor: '#2a0000', color: '#ff6666' }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3 shrink-0" style={{ borderTop: '1px solid #2a0000' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
            style={{ border: '1px solid #2a0000', color: '#9a8080' }}>Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: orgColor }}>
            {saving ? 'Saving…' : 'Save Script'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ScriptsSection({ scripts, activeScript, onSetActive, orgId, userId, orgColor, onReload }) {
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId]     = useState(null)
  const [deleting, setDeleting]     = useState(false)

  async function confirmDelete() {
    setDeleting(true)
    await supabase.from('scripts').delete().eq('id', deleteId)
    if (activeScript?.id === deleteId) onSetActive(null)
    setDeleteId(null)
    setDeleting(false)
    onReload()
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-white text-base">Practice Scripts</h2>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: orgColor }}>
            + New Script
          </button>
        </div>

        {scripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div style={{ fontSize: 52, opacity: 0.12 }}>📋</div>
            <p className="font-bold text-white">No scripts yet</p>
            <p className="text-sm" style={{ color: '#9a8080' }}>Create your first practice script to get started.</p>
            <button onClick={() => setShowCreate(true)} className="mt-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: orgColor }}>
              Create Script
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {scripts.map(script => {
              const isActive   = activeScript?.id === script.id
              const drillCount = script.drills?.length ?? 0
              const totalSec   = (script.drills ?? []).reduce((s, d) => s + (d.duration ?? 0), 0)
              const updated    = new Date(script.updated_at ?? script.created_at).toLocaleDateString()

              return (
                <div
                  key={script.id}
                  className="rounded-xl px-5 py-4 transition-all"
                  style={{
                    backgroundColor: '#1a0000',
                    border: `2px solid ${isActive ? orgColor : '#2a0000'}`,
                    boxShadow: isActive ? `0 0 20px ${orgColor}33` : 'none',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{script.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9a8080' }}>
                        {script.sport} · {drillCount} drill{drillCount !== 1 ? 's' : ''} · {fmt(totalSec)} total · Updated {updated}
                      </p>

                      {isActive && drillCount > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(script.drills ?? []).slice(0, 5).map((d, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: '#2a0000', color: '#9a8080' }}>
                              {d.name} ({fmt(d.duration ?? 0)})
                            </span>
                          ))}
                          {drillCount > 5 && (
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#2a0000', color: '#9a8080' }}>
                              +{drillCount - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => { onSetActive(isActive ? null : script) }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          backgroundColor: isActive ? orgColor : 'transparent',
                          border: `1px solid ${isActive ? orgColor : '#2a0000'}`,
                          color: isActive ? '#fff' : '#9a8080',
                        }}
                      >
                        {isActive ? 'Active ✓' : 'Set Active'}
                      </button>
                      <button onClick={() => setDeleteId(script.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ border: '1px solid #2a0000', color: '#9a8080' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal orgId={orgId} userId={userId} orgColor={orgColor}
          onClose={() => setShowCreate(false)} onCreated={onReload} />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
            <h3 className="font-bold text-white text-lg">Delete script?</h3>
            <p className="text-sm" style={{ color: '#9a8080' }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ border: '1px solid #2a0000', color: '#9a8080' }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: '#cc1111' }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
