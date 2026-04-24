import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const SPORTS = ['Football','Basketball','Volleyball','Baseball','Softball','Soccer','Track','Wrestling','Tennis','Other']
const ROLES  = ['admin','coach','readonly']

export default function SettingsSection({ org, profile, orgColor, onOrgUpdate }) {
  const [form, setForm] = useState({
    name:            org?.name            ?? '',
    sport:           org?.sport           ?? '',
    primary_color:   org?.primary_color   ?? '#cc1111',
    secondary_color: org?.secondary_color ?? '#ffffff',
  })
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [saveErr, setSaveErr]   = useState('')
  const [coaches, setCoaches]   = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('coach')
  const [inviting, setInviting]       = useState(false)
  const [inviteMsg, setInviteMsg]     = useState('')

  useEffect(() => {
    if (org) {
      setForm({ name: org.name, sport: org.sport, primary_color: org.primary_color, secondary_color: org.secondary_color })
      loadCoaches()
    }
  }, [org?.id])

  async function loadCoaches() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('org_id', org.id)
      .order('full_name')
    setCoaches(data ?? [])
  }

  async function saveSettings() {
    setSaving(true); setSaved(false); setSaveErr('')
    const { error: err } = await supabase
      .from('organizations')
      .update(form)
      .eq('id', org.id)
    if (err) { setSaveErr(err.message); setSaving(false); return }
    setSaving(false); setSaved(true)
    onOrgUpdate?.({ ...org, ...form })
    setTimeout(() => setSaved(false), 3000)
  }

  async function updateRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    loadCoaches()
  }

  function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteMsg(`Share the sign-up link with ${inviteEmail}: ${window.location.origin}`)
    setInviteEmail('')
  }

  function upd(key, val) { setForm(f => ({ ...f, [key]: val })) }

  const inputStyle = { backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#fff' }
  const section = (title, children) => (
    <div className="flex flex-col gap-4 p-5 rounded-2xl" style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
      <h3 className="font-bold text-white text-base">{title}</h3>
      {children}
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-xl mx-auto flex flex-col gap-5">

        {/* Program */}
        {section('Program Settings', <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>Program Name</label>
            <input value={form.name} onChange={e => upd('name', e.target.value)}
              className="rounded-lg px-4 py-2.5 text-sm outline-none" style={inputStyle} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>Sport</label>
            <select value={form.sport} onChange={e => upd('sport', e.target.value)}
              className="rounded-lg px-4 py-2.5 text-sm outline-none" style={inputStyle}>
              {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Colors */}
          <div className="flex gap-6 flex-wrap">
            {[['primary_color','Primary'],['secondary_color','Secondary']].map(([key,label]) => (
              <div key={key} className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>{label} Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form[key]} onChange={e => upd(key, e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                    style={{ backgroundColor: 'transparent', border: '1px solid #2a0000', padding: 2 }} />
                  <span className="text-sm font-mono" style={{ color: '#9a8080' }}>{form[key]}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Live preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#1a0000' }}>
            <span className="text-xs" style={{ color: '#9a8080' }}>Preview</span>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ backgroundColor: form.primary_color }}>
              <span className="text-sm font-bold" style={{ color: form.secondary_color, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.1em' }}>
                PRACTICEPACE
              </span>
            </div>
            <div className="w-6 h-6 rounded-full border-2 border-white/20" style={{ backgroundColor: form.primary_color }} />
            <div className="w-6 h-6 rounded-full border-2 border-white/20" style={{ backgroundColor: form.secondary_color }} />
          </div>

          {saveErr && <p className="text-xs text-center rounded-lg px-3 py-2" style={{ backgroundColor: '#2a0000', color: '#ff6666' }}>{saveErr}</p>}

          <button onClick={saveSettings} disabled={saving}
            className="py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50 transition-colors"
            style={{ backgroundColor: saved ? '#22c55e' : orgColor }}>
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </>)}

        {/* Coaches */}
        {section('Coaches & Staff', <>
          {coaches.length === 0 ? (
            <p className="text-sm" style={{ color: '#9a8080' }}>No coaches found.</p>
          ) : (
            <div className="flex flex-col divide-y" style={{ '--tw-divide-opacity': 1 }}>
              {coaches.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{c.full_name || '—'}</p>
                    <p className="text-xs truncate" style={{ color: '#9a8080' }}>{c.email}</p>
                  </div>
                  <select
                    value={c.role}
                    onChange={e => updateRole(c.id, e.target.value)}
                    disabled={c.id === profile?.id}
                    className="rounded-lg px-2 py-1.5 text-xs font-bold outline-none disabled:opacity-40"
                    style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000', color: orgColor }}>
                    {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Invite */}
          <form onSubmit={handleInvite} className="flex flex-col gap-3 pt-2" style={{ borderTop: '1px solid #2a0000' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9a8080' }}>Invite Coach</p>
            <div className="flex gap-2">
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="coach@school.edu"
                className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                className="rounded-lg px-2 py-2.5 text-xs font-bold outline-none"
                style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#fff' }}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <button type="submit" disabled={inviting}
              className="py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: orgColor }}>
              {inviting ? 'Sending…' : 'Generate Invite Link'}
            </button>
            {inviteMsg && (
              <p className="text-xs p-3 rounded-lg" style={{ backgroundColor: '#001a00', color: '#66cc88' }}>
                {inviteMsg}
              </p>
            )}
          </form>
        </>)}

      </div>
    </div>
  )
}
