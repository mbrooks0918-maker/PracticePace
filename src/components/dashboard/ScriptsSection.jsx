import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { saveGuestScript, deleteGuestScript } from '../../lib/guestStorage'

function pad(n) { return String(n).padStart(2, '0') }
function fmt(s) { return `${pad(Math.floor(s / 60))}:${pad(s % 60)}` }

// Values match the DB check constraint (all lowercase).
// Labels are title-case for display only.
const SPORTS = [
  { value: 'football',   label: 'Football' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'baseball',   label: 'Baseball' },
  { value: 'softball',   label: 'Softball' },
  { value: 'soccer',     label: 'Soccer' },
  { value: 'track',      label: 'Track' },
  { value: 'wrestling',  label: 'Wrestling' },
  { value: 'tennis',     label: 'Tennis' },
  { value: 'other',      label: 'Other' },
]

// ── Create Script Modal ───────────────────────────────────────────────────────
function CreateModal({ orgId, userId, orgColor, onClose, onCreated, isGuest, defaultSport }) {
  const [name, setName]   = useState('')
  // Default to the org's sport (already lowercase from DB), fall back to 'football'
  const [sport, setSport] = useState(defaultSport ?? 'football')
  const [drills, setDrills] = useState([{ name: '', duration: 300 }])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function addDrill() { setDrills(d => [...d, { name: '', duration: 300 }]) }
  function removeDrill(i) { setDrills(d => d.filter((_, idx) => idx !== i)) }
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

    const payload = {
      name: name.trim(),
      sport: sport.toLowerCase(),   // ensure lowercase regardless of how value was set
      drills: drills.map(d => ({ name: d.name.trim(), duration: Number(d.duration) || 60 })),
    }

    if (isGuest) {
      saveGuestScript(payload)
      onCreated(); onClose()
      return
    }

    const { error: err } = await supabase.from('scripts').insert({
      org_id: orgId,
      created_by: userId,
      ...payload,
    })
    if (err) { setError(err.message); setSaving(false); return }
    onCreated(); onClose()
  }

  const inputStyle = { backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#fff' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}>
      <div className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh]" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 shrink-0" style={{ borderBottom: '1px solid #2a0000' }}>
          <h2 className="font-bold text-white text-xl">New Practice Script</h2>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg text-xl"
            style={{ color: '#9a8080', backgroundColor: '#1a0000' }}>✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Name + sport row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>Script Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Monday Offense"
                className="rounded-lg px-4 py-3 text-sm outline-none" style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>Sport</label>
              <select value={sport} onChange={e => setSport(e.target.value)}
                className="rounded-lg px-4 py-3 text-sm outline-none" style={inputStyle}>
                {SPORTS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Drills */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>
                Segments — {drills.length} total · {fmt(drills.reduce((s,d) => s + (d.duration || 0), 0))} total time
              </label>
              <button onClick={addDrill} className="text-sm font-bold px-4 py-2 rounded-lg"
                style={{ backgroundColor: `${orgColor}22`, color: orgColor, border: `1px solid ${orgColor}` }}>
                + Add
              </button>
            </div>

            {drills.map((drill, i) => (
              <div key={i} className="flex gap-2 items-center p-3 rounded-xl" style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000' }}>
                <span className="text-xs font-bold w-5 text-center shrink-0" style={{ color: '#4a2020' }}>{i + 1}</span>
                <input value={drill.name} onChange={e => updateDrill(i, 'name', e.target.value)}
                  placeholder={`Segment ${i + 1}`}
                  className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={{ backgroundColor: '#0d0000', border: '1px solid #2a0000', color: '#fff' }} />
                <div className="flex items-center gap-1.5 shrink-0">
                  <input type="number" value={drillMins(i)} min={0} onChange={e => setMins(i, e.target.value)}
                    className="w-14 rounded-lg px-2 py-2.5 text-sm text-center outline-none" style={{ backgroundColor: '#0d0000', border: '1px solid #2a0000', color: '#fff' }} />
                  <span className="text-xs" style={{ color: '#9a8080' }}>m</span>
                  <input type="number" value={drillSecs2(i)} min={0} max={59} onChange={e => setSecs(i, e.target.value)}
                    className="w-14 rounded-lg px-2 py-2.5 text-sm text-center outline-none" style={{ backgroundColor: '#0d0000', border: '1px solid #2a0000', color: '#fff' }} />
                  <span className="text-xs" style={{ color: '#9a8080' }}>s</span>
                </div>
                {drills.length > 1 && (
                  <button onClick={() => removeDrill(i)} className="w-9 h-9 flex items-center justify-center rounded-lg text-sm shrink-0"
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
        <div className="px-6 py-5 flex gap-3 shrink-0" style={{ borderTop: '1px solid #2a0000' }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-lg text-sm font-semibold"
            style={{ border: '1px solid #2a0000', color: '#9a8080' }}>Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: orgColor }}>
            {saving ? 'Saving…' : 'Save Script'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ScriptsSection({ scripts, activeScript, onSetActive, orgId, userId, orgColor, isGuest, orgSport, onReload }) {
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId]     = useState(null)
  const [deleting, setDeleting]     = useState(false)

  async function confirmDelete() {
    setDeleting(true)
    if (isGuest) {
      deleteGuestScript(deleteId)
    } else {
      await supabase.from('scripts').delete().eq('id', deleteId)
    }
    if (activeScript?.id === deleteId) onSetActive(null)
    setDeleteId(null); setDeleting(false)
    onReload()
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 max-w-5xl mx-auto">
        <h2 className="font-bold text-white text-lg">Practice Scripts</h2>
        <button onClick={() => setShowCreate(true)}
          className="px-5 py-3 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: orgColor }}>
          + New Script
        </button>
      </div>

      {scripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center max-w-5xl mx-auto">
          <div style={{ fontSize: 64, opacity: 0.1 }}>📋</div>
          <p className="font-bold text-white text-lg">No scripts yet</p>
          <p className="text-sm" style={{ color: '#9a8080' }}>Create your first practice script to get started.</p>
          <button onClick={() => setShowCreate(true)} className="mt-2 px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: orgColor }}>
            Create Script
          </button>
        </div>
      ) : (
        /* iPad: 2-column grid */
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
          {scripts.map(script => {
            const isActive   = activeScript?.id === script.id
            const drillCount = script.drills?.length ?? 0
            const totalSec   = (script.drills ?? []).reduce((s, d) => s + (d.duration ?? 0), 0)
            const updated    = new Date(script.updated_at ?? script.created_at).toLocaleDateString()

            return (
              <div
                key={script.id}
                className="rounded-2xl p-5 flex flex-col gap-3 transition-all"
                style={{
                  backgroundColor: '#1a0000',
                  border: `2px solid ${isActive ? orgColor : '#2a0000'}`,
                  boxShadow: isActive ? `0 0 24px ${orgColor}33` : 'none',
                }}
              >
                {/* Top: name + buttons */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-white truncate text-base">{script.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9a8080' }}>
                      {script.sport} · {drillCount} segment{drillCount !== 1 ? 's' : ''} · {fmt(totalSec)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#4a2020' }}>Updated {updated}</p>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => onSetActive(isActive ? null : script)}
                      className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                      style={{
                        backgroundColor: isActive ? orgColor : 'transparent',
                        border: `1px solid ${isActive ? orgColor : '#2a0000'}`,
                        color: isActive ? '#fff' : '#9a8080',
                      }}
                    >
                      {isActive ? '✓ Active' : 'Set Active'}
                    </button>
                    <button onClick={() => setDeleteId(script.id)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold"
                      style={{ border: '1px solid #2a0000', color: '#6a3030' }}>
                      Delete
                    </button>
                  </div>
                </div>

                {/* Drill chips */}
                {drillCount > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(script.drills ?? []).slice(0, 6).map((d, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: '#2a0000', color: isActive ? '#cc8888' : '#7a5050' }}>
                        {d.name}
                        <span className="ml-1 opacity-60">{fmt(d.duration ?? 0)}</span>
                      </span>
                    ))}
                    {drillCount > 6 && (
                      <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: '#2a0000', color: '#7a5050' }}>
                        +{drillCount - 6} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateModal orgId={orgId} userId={userId} orgColor={orgColor} isGuest={isGuest}
          defaultSport={orgSport?.toLowerCase() ?? 'football'}
          onClose={() => setShowCreate(false)} onCreated={onReload} />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
            <h3 className="font-bold text-white text-lg">Delete script?</h3>
            <p className="text-sm" style={{ color: '#9a8080' }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-lg text-sm font-semibold"
                style={{ border: '1px solid #2a0000', color: '#9a8080' }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} className="flex-1 py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50"
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
