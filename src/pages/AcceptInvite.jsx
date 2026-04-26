// ── AcceptInvite ──────────────────────────────────────────────────────────────
// Coaches land here after clicking an invite link: /invite?token=UUID
//
// SUPABASE SETUP REQUIRED (run once in SQL editor):
//
//   -- Allow unauthenticated users to look up a valid invite by token.
//   -- The token is a 128-bit UUID — knowing it IS the authorization.
//   CREATE POLICY "public can read valid invites" ON coach_invites
//     FOR SELECT USING (used = false AND expires_at > now());
//
//   -- Optional: allow new users to mark their own invite used on sign-up.
//   -- This is handled server-side via the admin client in a serverless fn,
//   -- so the SELECT policy above is the only one needed for the client.

import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import { supabase }            from '../lib/supabase'
import Logo                    from '../components/Logo'

export default function AcceptInvite() {
  const navigate = useNavigate()
  const token    = new URLSearchParams(window.location.search).get('token')

  // ── Invite lookup state ────────────────────────────────────────────────────
  const [invite,      setInvite]      = useState(null)   // { id, org_id, email, name, role, organizations: { name } }
  const [lookupDone,  setLookupDone]  = useState(false)
  const [lookupError, setLookupError] = useState('')

  // ── Form state ─────────────────────────────────────────────────────────────
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [fullName,  setFullName]  = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr]  = useState('')
  const [done,      setDone]      = useState(false)  // account created, awaiting email confirm

  // ── Load invite on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setLookupError('No invite token found. Check your link and try again.')
      setLookupDone(true)
      return
    }

    async function fetchInvite() {
      try {
        // Requires "public can read valid invites" SELECT policy (see header comment).
        const { data, error } = await supabase
          .from('coach_invites')
          .select('id, org_id, email, name, role, expires_at, organizations(name)')
          .eq('token', token)
          .eq('used', false)
          .maybeSingle()

        if (error) throw new Error(error.message)

        if (!data) {
          setLookupError('This invite link is invalid, has already been used, or has expired.')
          setLookupDone(true)
          return
        }

        // Extra client-side expiry check (DB already filters, but belt + suspenders)
        if (new Date(data.expires_at) < new Date()) {
          setLookupError('This invite link has expired. Ask your admin to send a new one.')
          setLookupDone(true)
          return
        }

        setInvite(data)
        setEmail(data.email ?? '')
        setFullName(data.name ?? '')
      } catch (err) {
        console.error('[AcceptInvite] lookup error:', err)
        setLookupError(err.message ?? 'Could not load invite. Try again later.')
      } finally {
        setLookupDone(true)
      }
    }

    fetchInvite()
  }, [token])

  // ── Submit: create account ─────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setSubmitting(true); setSubmitErr('')

    try {
      // 1. Create Supabase auth account
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email:    email.trim(),
        password,
        options:  { data: { full_name: fullName.trim() } },
      })

      if (signUpErr) throw new Error(signUpErr.message)

      const userId = authData?.user?.id
      if (!userId) throw new Error('Account creation failed — please try again.')

      // 2. If session is available immediately (email confirm disabled), create profile now.
      //    If not, the profile is created on first sign-in via the onboarding flow.
      if (authData.session) {
        const { error: profErr } = await supabase.from('profiles').upsert({
          id:         userId,
          org_id:     invite.org_id,
          email:      email.trim(),
          full_name:  fullName.trim(),
          role:       invite.role ?? 'coach',
        }, { onConflict: 'id' })

        if (profErr) {
          console.warn('[AcceptInvite] profile upsert error (non-fatal):', profErr.message)
        }

        // 3. Mark invite used (best-effort — don't block on failure)
        await supabase
          .from('coach_invites')
          .update({ used: true })
          .eq('id', invite.id)
          .then(() => {})

        // 4. Go straight to dashboard
        navigate('/dashboard')
        return
      }

      // Email confirmation is required — mark invite used so it can't be reused,
      // then tell the coach to check their inbox.
      await supabase
        .from('coach_invites')
        .update({ used: true })
        .eq('id', invite.id)
        .then(() => {})

      setDone(true)
    } catch (err) {
      console.error('[AcceptInvite] sign-up error:', err)
      setSubmitErr(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Shared styles ──────────────────────────────────────────────────────────
  const inputStyle = {
    backgroundColor: '#1a0000',
    border:          '1px solid #2a0000',
    color:           '#fff',
  }

  const orgName = invite?.organizations?.name ?? 'your program'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 gap-6"
      style={{ backgroundColor: '#080000' }}
    >
      <Logo variant="white" height={44} />

      <div
        className="w-full max-w-sm rounded-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}
      >
        {/* Header */}
        <div className="px-6 py-5" style={{ borderBottom: '1px solid #2a0000' }}>
          <h1 className="font-black text-white text-xl leading-tight">
            {!lookupDone
              ? 'Loading invite…'
              : lookupError
                ? 'Invite Not Found'
                : done
                  ? 'Check Your Email'
                  : `Join ${orgName}`}
          </h1>
          {!lookupError && !done && invite && (
            <p className="text-xs mt-1" style={{ color: '#9a8080' }}>
              You've been invited as a <span className="font-bold text-white capitalize">{invite.role}</span> on PracticePace
            </p>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Loading */}
          {!lookupDone && (
            <div className="flex items-center justify-center py-8">
              <div
                className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: '#cc1111', borderTopColor: 'transparent' }}
              />
            </div>
          )}

          {/* Lookup error */}
          {lookupDone && lookupError && (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed" style={{ color: '#ff8888' }}>
                {lookupError}
              </p>
              <button
                onClick={() => navigate('/')}
                className="py-3 rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: '#cc1111' }}
              >
                Go to Sign In
              </button>
            </div>
          )}

          {/* Email confirmation needed */}
          {done && (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed" style={{ color: '#66cc88' }}>
                ✓ Account created! Check your email inbox for a confirmation link.
                Once confirmed, sign in and you'll have full access to {orgName}.
              </p>
              <button
                onClick={() => navigate('/')}
                className="py-3 rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: '#cc1111' }}
              >
                Go to Sign In
              </button>
            </div>
          )}

          {/* Sign-up form */}
          {lookupDone && invite && !done && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: '#9a8080' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Coach Smith"
                  className="rounded-lg px-4 py-3 text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: '#9a8080' }}>
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="rounded-lg px-4 py-3 text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: '#9a8080' }}>
                  Create Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="rounded-lg px-4 py-3 text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              {submitErr && (
                <p className="text-xs rounded-lg px-3 py-2"
                  style={{ backgroundColor: '#2a0000', color: '#ff6666' }}>
                  {submitErr}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !email || !password}
                className="py-3 rounded-lg text-sm font-bold text-white disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#cc1111' }}
              >
                {submitting ? 'Creating account…' : 'Create Account'}
              </button>

              <p className="text-xs text-center" style={{ color: '#4a2020' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="underline font-semibold"
                  style={{ color: '#9a8080' }}
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
