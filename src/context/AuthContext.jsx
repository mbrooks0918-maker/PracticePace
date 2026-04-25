import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)   // { id, account_id, org_id, role, full_name, email }
  const [loading, setLoading] = useState(true)
  const loadingDone = useRef(false)

  function resolveLoading() {
    if (!loadingDone.current) {
      loadingDone.current = true
      setLoading(false)
    }
  }

  // Fetch the profile row for an authenticated (non-anonymous) user.
  // Anonymous / guest users never have a profile row — that's fine.
  // Never throws — errors are caught and treated as "no profile".
  async function fetchProfile(authUser) {
    if (!authUser || authUser.is_anonymous) {
      setProfile(null)
      return
    }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, account_id, org_id, role, full_name, email')
        .eq('id', authUser.id)
        .maybeSingle()          // maybeSingle never errors on 0 rows
      setProfile(data ?? null)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    // Safety net: if loading hasn't resolved after 5 s, force it to false
    const timeout = setTimeout(() => {
      console.warn('[Auth] Loading timeout — forcing loading=false')
      resolveLoading()
    }, 5000)

    // 1. Restore existing session on mount
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        const authUser = session?.user ?? null
        setUser(authUser)
        await fetchProfile(authUser)
      })
      .catch(err => {
        console.error('[Auth] getSession error:', err)
      })
      .finally(() => {
        clearTimeout(timeout)
        resolveLoading()
      })

    // 2. Keep in sync with every auth state change (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      await fetchProfile(authUser)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    // Clear state immediately so the rest of the app sees no user at once
    setUser(null)
    setProfile(null)
    await supabase.auth.signOut()
    // Hard redirect — guarantees clean slate regardless of React Router state
    window.location.replace('/')
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
