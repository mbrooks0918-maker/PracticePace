import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  // If AuthContext is somehow still loading after 6 s, stop waiting and redirect to login
  const [timedOut, setTimedOut] = useState(false)

  console.log('[ACTIVE] ProtectedRoute render — loading:', loading, 'user.id:', user?.id ?? null, 'profile.id:', profile?.id ?? null, 'path:', location.pathname, 'timedOut:', timedOut)

  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setTimedOut(true), 6000)
    return () => clearTimeout(t)
  }, [loading])

  if (loading && !timedOut) {
    console.log('[ACTIVE] ProtectedRoute → rendering SPINNER (children unmounted while this branch is taken)')
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#080000' }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: '#cc1111', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: '#9a8080' }}>Loading…</p>
        </div>
      </div>
    )
  }

  // Not authenticated at all → login
  if (!user) {
    console.log('[ACTIVE] ProtectedRoute → no user, redirecting to /')
    return <Navigate to="/" replace />
  }

  // Anonymous / guest users never need a profile — let them through
  if (user.is_anonymous) {
    console.log('[ACTIVE] ProtectedRoute → anonymous user, rendering children')
    return children
  }

  // Authenticated user with a profile → go to dashboard if they try to hit /onboarding
  if (profile && location.pathname === '/onboarding') {
    console.log('[ACTIVE] ProtectedRoute → authed + profile + on /onboarding, redirect to /dashboard')
    return <Navigate to="/dashboard" replace />
  }

  // Authenticated user with NO profile → they need to complete onboarding
  // (unless they're already heading there, which avoids an infinite redirect)
  if (!profile && location.pathname !== '/onboarding') {
    console.log('[ACTIVE] ProtectedRoute → authed but no profile, redirect to /onboarding')
    return <Navigate to="/onboarding" replace />
  }

  console.log('[ACTIVE] ProtectedRoute → rendering children (path:', location.pathname, ')')
  return children
}
