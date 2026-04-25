import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import Tagline from '../components/Tagline'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // 'signin' | 'create'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    // 10 s hard timeout — if the auth flow hangs, unblock the button and show an error
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      setLoading(false)
      setError('Request timed out. Check your connection and try again.')
      console.error('[Login] Auth flow timed out after 10 s')
    }, 10_000)

    try {
      if (mode === 'create') {
        console.log('[Login] Attempting sign up for', email)
        const { error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        console.log('[Login] Sign up succeeded — awaiting email confirmation')
        setInfo('Check your email to confirm your account, then sign in.')
        setMode('signin')
        return
      }

      console.log('[Login] Attempting sign in for', email)
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      console.log('[Login] signInWithPassword result:', { userId: data?.user?.id, error: signInError?.message })
      if (signInError) throw signInError

      if (timedOut) return  // timeout already reset loading — don't navigate

      console.log('[Login] Checking profiles table for user', data.user.id)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()
      console.log('[Login] Profile check result:', { profile, error: profileError?.message })

      if (timedOut) return

      navigate(profile ? '/dashboard' : '/onboarding')
    } catch (err) {
      console.error('[Login] Auth error:', err)
      if (!timedOut) setError(err.message ?? 'Something went wrong.')
    } finally {
      clearTimeout(timeout)
      if (!timedOut) setLoading(false)
    }
  }

  async function handleGuest() {
    setError('')
    setLoading(true)

    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      setLoading(false)
      setError('Request timed out. Check your connection and try again.')
      console.error('[Login] Guest sign in timed out after 10 s')
    }, 10_000)

    try {
      console.log('[Login] Attempting anonymous sign in')
      const { error: guestError } = await supabase.auth.signInAnonymously()
      if (guestError) throw guestError
      console.log('[Login] Anonymous sign in succeeded')
      if (!timedOut) navigate('/dashboard')
    } catch (err) {
      console.error('[Login] Guest error:', err)
      if (!timedOut) setError(err.message ?? 'Something went wrong.')
    } finally {
      clearTimeout(timeout)
      if (!timedOut) setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#080000' }}
    >
      {/* Logo + tagline — above the card */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <Logo variant="white" height={48} />
        <Tagline />
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm md:max-w-md rounded-2xl px-8 py-10 flex flex-col items-center gap-6"
        style={{ backgroundColor: '#110000', border: '1px solid #2a0000' }}
      >

        {/* Mode toggle */}
        <div
          className="flex w-full rounded-lg overflow-hidden text-sm font-semibold"
          style={{ border: '1px solid #2a0000' }}
        >
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(''); setInfo('') }}
            className="flex-1 py-2 transition-colors"
            style={{
              backgroundColor: mode === 'signin' ? '#cc1111' : 'transparent',
              color: mode === 'signin' ? '#fff' : '#9a8080',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('create'); setError(''); setInfo('') }}
            className="flex-1 py-2 transition-colors"
            style={{
              backgroundColor: mode === 'create' ? '#cc1111' : 'transparent',
              color: mode === 'create' ? '#fff' : '#9a8080',
            }}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="coach@team.com"
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
              style={{
                backgroundColor: '#1a0000',
                border: '1px solid #2a0000',
                color: '#ffffff',
                caretColor: '#cc1111',
              }}
              onFocus={e => (e.target.style.borderColor = '#cc1111')}
              onBlur={e => (e.target.style.borderColor = '#2a0000')}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8080' }}>
              Password
            </label>
            <input
              type="password"
              required
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
              style={{
                backgroundColor: '#1a0000',
                border: '1px solid #2a0000',
                color: '#ffffff',
                caretColor: '#cc1111',
              }}
              onFocus={e => (e.target.style.borderColor = '#cc1111')}
              onBlur={e => (e.target.style.borderColor = '#2a0000')}
            />
          </div>

          {/* Error / info */}
          {error && (
            <p className="text-sm text-center rounded-lg px-3 py-2" style={{ backgroundColor: '#2a0000', color: '#ff6666' }}>
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-center rounded-lg px-3 py-2" style={{ backgroundColor: '#001a00', color: '#66cc66' }}>
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-white text-sm tracking-wide transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#cc1111' }}
          >
            {loading ? 'Loading…' : mode === 'create' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px" style={{ backgroundColor: '#2a0000' }} />
          <span className="text-xs" style={{ color: '#4a2020' }}>or</span>
          <div className="flex-1 h-px" style={{ backgroundColor: '#2a0000' }} />
        </div>

        {/* Guest */}
        <button
          type="button"
          onClick={handleGuest}
          disabled={loading}
          className="text-sm transition-colors disabled:opacity-50"
          style={{ color: '#9a8080' }}
          onMouseEnter={e => (e.target.style.color = '#cc1111')}
          onMouseLeave={e => (e.target.style.color = '#9a8080')}
        >
          Continue as guest →
        </button>
      </div>
    </div>
  )
}
