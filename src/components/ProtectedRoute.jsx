import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  // If AuthContext is somehow still loading after 6 s, stop waiting and redirect to login
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setTimedOut(true), 6000)
    return () => clearTimeout(t)
  }, [loading])

  if (loading && !timedOut) {
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

  if (!user) return <Navigate to="/" replace />
  return children
}
