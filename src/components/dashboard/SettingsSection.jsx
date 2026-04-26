// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE STORAGE SETUP (one-time, do this before using background upload):
//   1. Go to your Supabase project → Storage → New bucket
//   2. Name it exactly:  backgrounds
//   3. Toggle "Public bucket" ON
//   4. Click Create
//
// Also run this SQL if you haven't already:
//   ALTER TABLE organizations ADD COLUMN IF NOT EXISTS background_url text;
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const SPORTS = ['Football','Basketball','Volleyball','Baseball','Softball','Soccer','Track','Wrestling','Tennis','Other']
const ROLES  = ['admin','coach','readonly']

// ─────────────────────────────────────────────────────────────────────────────
// Section must live OUTSIDE SettingsSection so React never creates a new
// component-type reference on each render — that would unmount/remount every
// child (including focused inputs) on every keystroke.
// ─────────────────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl"
      style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}>
      <h3 className="font-bold text-white text-base">{title}</h3>
      {children}
    </div>
  )
}

export default function SettingsSection({ org, profile, orgColor, onOrgUpdate }) {
  const { user, loading: authLoading } = useAuth()

  // Form only tracks name + sport — color pickers removed (not needed by coaches)
  const [form, setForm] = useState({
    name:  org?.name  ?? '',
    sport: (org?.sport ?? '').toLowerCase(),   // normalize so it always matches option values
  })
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [saveErr, setSaveErr] = useState('')

  const [coaches, setCoaches]         = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName]   = useState('')
  const [inviteRole, setInviteRole]   = useState('coach')
  const [inviting, setInviting]       = useState(false)
  const [inviteMsg, setInviteMsg]     = useState('')
  const [inviteErr, setInviteErr]     = useState('')
  const [copied, setCopied]           = useState(false)

  const [bgUploading, setBgUploading] = useState(false)
  const [bgError, setBgError]         = useState('')
  const [bgSuccess, setBgSuccess]     = useState(false)
  const bgInputRef = useRef(null)

  // Sync form whenever org changes (includes initial load when org arrives async)
  useEffect(() => {
    if (org?.id) {
      setForm({
        name:  org.name  ?? '',
        sport: (org.sport ?? '').toLowerCase(),   // normalize to match option values
      })
      loadCoaches()
    }
  }, [org?.id, org?.name, org?.sport])

  async function loadCoaches() {
    if (!org?.id) return
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('org_id', org.id)
      .order('full_name')
    setCoaches(data ?? [])
  }

  async function saveSettings() {
    if (!form.name.trim()) { setSaveErr('Program name is required.'); return }
    setSaving(true); setSaved(false); setSaveErr('')
    try {
      if (org?.id) {
        // ── Existing org: update ──────────────────────────────────────────────
        const { error: err } = await supabase
          .from('organizations')
          .update({ name: form.name.trim(), sport: form.sport })
          .eq('id', org.id)
        if (err) { setSaveErr(err.message); return }
        setSaved(true)
        onOrgUpdate?.({ ...org, name: form.name.trim(), sport: form.sport })
      } else {
        // ── No org yet: create org + profile (first-time setup) ──────────────
        const userId = user?.id
        if (!userId) { setSaveErr('Not signed in — please reload.'); return }

        // Generate org ID client-side so we don't need a SELECT-after-INSERT
        // (profile row doesn't exist yet, so org SELECT policies would block it)
        const orgId = crypto.randomUUID()
        const slug  = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now()

        // 1. Insert org (no .select() — avoids SELECT policy chicken-and-egg)
        const { error: orgErr } = await supabase
          .from('organizations')
          .insert({ id: orgId, name: form.name.trim(), sport: form.sport || 'football', slug, primary_color: '#cc1111', secondary_color: '#ffffff' })
        if (orgErr) { setSaveErr(`Could not create org: ${orgErr.message}`); return }

        // 2. Link profile to the new org
        const { error: profErr } = await supabase
          .from('profiles')
          .upsert({ id: userId, org_id: orgId, email: user?.email ?? '', role: 'admin', full_name: profile?.full_name ?? '' }, { onConflict: 'id' })
        if (profErr) { setSaveErr(`Could not link profile: ${profErr.message}`); return }

        setSaved(true)
        // Reload so Dashboard re-fetches everything with the new org
        setTimeout(() => window.location.reload(), 1200)
      }
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setSaveErr(e.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function uploadBackground(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Guard: org must be loaded before we can save the URL
    if (!org?.id) {
      setBgError('Organization not loaded yet — please wait a moment and try again.')
      return
    }
    if (!file.type.startsWith('image/')) { setBgError('Please select an image file.'); return }
    if (file.size > 10 * 1024 * 1024) { setBgError('Image must be under 10 MB.'); return }

    setBgUploading(true); setBgError(''); setBgSuccess(false)

    // ── HOW TO CREATE THE BUCKET ────────────────────────────────────────────
    // 1. Go to Supabase → Storage → New bucket
    // 2. Name it exactly:  backgrounds
    // 3. Toggle "Public bucket" ON
    // 4. Click Create
    // ────────────────────────────────────────────────────────────────────────

    try {
      const ext  = file.name.split('.').pop()
      const path = `org-${org.id}/practice-bg.${ext}`

      const { error: upErr } = await supabase.storage
        .from('backgrounds')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (upErr) {
        const msg = upErr.message ?? ''
        setBgError(
          msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('bucket')
            ? 'Storage bucket "backgrounds" not found.\n\nTo fix: Supabase → Storage → New bucket → name it "backgrounds" → enable Public → Create.'
            : `Upload failed: ${msg}`
        )
        return
      }

      const { data: urlData } = supabase.storage.from('backgrounds').getPublicUrl(path)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) { setBgError('Could not get image URL. Check bucket public setting.'); return }

      const bgUrl = `${publicUrl}?v=${Date.now()}`

      const { error: dbErr } = await supabase
        .from('organizations')
        .update({ background_url: bgUrl })
        .eq('id', org.id)

      if (dbErr) {
        setBgError(`Upload failed: ${dbErr.message}`)
        return
      }

      setBgSuccess(true)
      onOrgUpdate?.({ ...org, background_url: bgUrl })
      setTimeout(() => setBgSuccess(false), 5000)
      if (bgInputRef.current) bgInputRef.current.value = ''
    } catch (err) {
      setBgError(err.message ?? 'Upload failed. Please try again.')
    } finally {
      setBgUploading(false)
    }
  }

  async function clearBackground() {
    if (!org?.id) return
    const { error } = await supabase
      .from('organizations')
      .update({ background_url: null })
      .eq('id', org.id)
    if (!error) onOrgUpdate?.({ ...org, background_url: null })
  }

  async function updateRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    loadCoaches()
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim() || !org?.id) return
    setInviting(true); setInviteMsg(''); setInviteErr(''); setCopied(false)

    try {
      // Generate a cryptographically random token client-side so we can build
      // the link immediately without a SELECT round-trip.
      const token     = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const { error } = await supabase.from('coach_invites').insert({
        org_id:     org.id,
        email:      inviteEmail.trim(),
        name:       inviteName.trim() || null,
        role:       inviteRole,
        token,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      })

      if (error) throw new Error(error.message)

      const link = `https://practicepace.app/invite?token=${token}`

      // Copy to clipboard immediately — don't wait for user to click "Copy"
      try {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 4000)
      } catch {
        // clipboard blocked (non-HTTPS / permissions) — still show the link
      }

      setInviteMsg(link)
      setInviteEmail('')
      setInviteName('')
    } catch (err) {
      setInviteErr(err.message ?? 'Could not generate invite.')
    } finally {
      setInviting(false)
    }
  }

  function copyInviteLink() {
    if (!inviteMsg) return
    navigator.clipboard?.writeText(inviteMsg).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function upd(key, val) { setForm(f => ({ ...f, [key]: val })) }

  const inputStyle = { backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#fff' }

  // ── Loading guard ────────────────────────────────────────────────────────────
  // Spin only while auth is actively loading. Once done, always show the form —
  // if org is null the user will fill in their details and we'll create it on Save.
  if (!org && authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: orgColor, borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: '#9a8080' }}>Loading settings…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-5">

          {/* Program Settings */}
          <Section title="Program Settings">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>
                Program Name
              </label>
              <input
                value={form.name}
                onChange={e => upd('name', e.target.value)}
                placeholder="Albertville Aggies Football"
                className="rounded-lg px-4 py-3 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>Sport</label>
              <select
                value={form.sport}
                onChange={e => upd('sport', e.target.value)}
                className="rounded-lg px-4 py-3 text-sm outline-none"
                style={inputStyle}
              >
                <option value="">Select sport…</option>
                {SPORTS.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
              </select>
            </div>

            {saveErr && (
              <p className="text-xs text-center rounded-lg px-3 py-2" style={{ backgroundColor: '#2a0000', color: '#ff6666' }}>
                {saveErr}
              </p>
            )}
            <button
              onClick={saveSettings}
              disabled={saving}
              className="py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: saved ? '#22c55e' : orgColor }}
            >
              {saving ? 'Saving…' : saved ? '✓ Saved!' : org?.id ? 'Save Changes' : 'Create Program'}
            </button>
          </Section>

          {/* Practice Background */}
          <Section title="Practice Screen Background">
            <p className="text-xs leading-relaxed" style={{ color: '#9a8080' }}>
              Upload an image that appears behind the clock on the Practice screen.
              Use a{' '}
              <span className="font-semibold text-white">landscape image at least 1366 × 1024 px</span>
              {' '}(JPG or PNG, max 10 MB). A darker image works best.
            </p>

            {org?.background_url && (
              <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <img
                  src={org.background_url}
                  alt="Practice background"
                  className="w-full h-full object-cover"
                  style={{ opacity: 0.7 }}
                />
                <div className="absolute inset-0 flex items-end p-3 justify-end">
                  <button
                    onClick={clearBackground}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #cc1111', color: '#cc1111' }}
                  >
                    ✕ Remove
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <input ref={bgInputRef} type="file" accept="image/*" onChange={uploadBackground} className="hidden" id="bg-upload" />
              <label
                htmlFor="bg-upload"
                className="flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold cursor-pointer transition-all"
                style={{
                  border:          `2px dashed ${bgUploading ? orgColor : '#2a0000'}`,
                  color:           bgUploading ? orgColor : '#9a8080',
                  backgroundColor: '#1a0000',
                  pointerEvents:   bgUploading ? 'none' : 'auto',
                }}
              >
                {bgUploading
                  ? <><span className="animate-spin inline-block">⟳</span> Uploading…</>
                  : <>📸 {org?.background_url ? 'Replace Background Image' : 'Upload Background Image'}</>
                }
              </label>

              {bgError && (
                <p className="text-xs rounded-lg px-3 py-2 leading-relaxed whitespace-pre-line"
                  style={{ backgroundColor: '#2a0000', color: '#ff6666' }}>
                  {bgError}
                </p>
              )}
              {bgSuccess && (
                <p className="text-xs rounded-lg px-3 py-2 font-semibold"
                  style={{ backgroundColor: '#001a00', color: '#66cc88' }}>
                  ✓ Background updated! Switch to the Practice tab to see it.
                </p>
              )}
            </div>

            {/* dev setup notes removed — see file header comment */}
          </Section>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col gap-5">

          {/* Coaches & Staff */}
          <Section title="Coaches & Staff">
            {coaches.length === 0 ? (
              <p className="text-sm" style={{ color: '#9a8080' }}>No coaches found for this org.</p>
            ) : (
              <div className="flex flex-col">
                {coaches.map((c, i) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 py-3"
                    style={{ borderTop: i === 0 ? 'none' : '1px solid #1a0000' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{c.full_name || '—'}</p>
                      <p className="text-xs truncate" style={{ color: '#9a8080' }}>{c.email}</p>
                    </div>
                    <select
                      value={c.role}
                      onChange={e => updateRole(c.id, e.target.value)}
                      disabled={c.id === profile?.id}
                      className="rounded-lg px-2 py-2 text-xs font-bold outline-none disabled:opacity-40"
                      style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000', color: orgColor }}
                    >
                      {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* Invite form */}
            <form onSubmit={handleInvite} className="flex flex-col gap-3 pt-3" style={{ borderTop: '1px solid #2a0000' }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9a8080' }}>Invite Coach</p>

              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Coach full name (optional)"
                className="rounded-lg px-3 py-3 text-sm outline-none"
                style={inputStyle}
              />

              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="coach@school.edu"
                  className="flex-1 rounded-lg px-3 py-3 text-sm outline-none"
                  style={inputStyle}
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="rounded-lg px-2 py-3 text-xs font-bold outline-none"
                  style={{ backgroundColor: '#1a0000', border: '1px solid #2a0000', color: '#fff' }}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <button
                type="submit"
                disabled={inviting}
                className="py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: orgColor }}
              >
                {inviting ? 'Generating…' : 'Generate Invite Link'}
              </button>

              {inviteErr && (
                <p className="text-xs p-3 rounded-lg" style={{ backgroundColor: '#2a0000', color: '#ff6666' }}>
                  {inviteErr}
                </p>
              )}

              {inviteMsg && (
                <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ backgroundColor: '#001a00', border: '1px solid #003300' }}>
                  <p className="text-xs font-semibold" style={{ color: '#66cc88' }}>
                    {copied
                      ? '✓ Invite link copied to clipboard — share it with your coach'
                      : '✓ Invite link ready — share with the coach:'}
                  </p>
                  <p className="text-xs break-all font-mono" style={{ color: '#9a9a9a' }}>{inviteMsg}</p>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="self-start px-4 py-2 rounded-lg text-xs font-bold transition-all"
                    style={{
                      backgroundColor: copied ? '#22c55e22' : `${orgColor}22`,
                      border:          `1px solid ${copied ? '#22c55e' : orgColor}`,
                      color:           copied ? '#22c55e' : orgColor,
                    }}
                  >
                    {copied ? '✓ Copied!' : 'Copy Link'}
                  </button>
                </div>
              )}
            </form>
          </Section>

          {/* Account info */}
          <Section title="Your Account">
            <div className="flex flex-col gap-3">
              {[
                { label: 'Name',  value: profile?.full_name },
                { label: 'Email', value: profile?.email },
                { label: 'Role',  value: profile?.role },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-xs uppercase tracking-widest" style={{ color: '#4a2020' }}>{label}</span>
                  <span className="text-sm font-semibold text-white capitalize">{value || '—'}</span>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>
    </div>
  )
}
