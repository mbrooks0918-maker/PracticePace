import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)   // { id, account_id, org_id, role, full_name, email }
  const [loading, setLoading] = useState(true)

  // Fetch profile for an authenticated non-anonymous user.
  // Never throws — errors are treated as "no profile".
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
        .maybeSingle()
      setProfile(data ?? null)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    // Safety net: force loading=false after 5 s no matter what
    const timeout = setTimeout(() => {
      console.warn('[Auth] Loading timeout — forcing loading=false')
      setLoading(false)
    }, 5000)

    // 1. Restore existing session on mount (sets initial loading state)
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
        setLoading(false)
      })

    // 2. React to auth events after mount.
    //
    // SIGNED_IN: set loading=true before fetchProfile so ProtectedRoute waits
    // for the profile before making routing decisions. Without this, the route
    // renders while user is set but profile is still null, which incorrectly
    // triggers the "no profile → /onboarding" redirect.
    //
    // SIGNED_OUT: clear state immediately.
    //
    // Everything else (TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION, etc.):
    // update silently without touching loading.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const authUser = session?.user ?? null

      if (event === 'SIGNED_IN') {
        setLoading(true)
        setUser(authUser)
        // Race fetchProfile against a 4 s timeout so a flaky network on
        // iPad resume can never leave loading=true indefinitely.
        await Promise.race([
          fetchProfile(authUser),
          new Promise(resolve => setTimeout(resolve, 4000)),
        ])
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
      } else {
        // TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION, PASSWORD_RECOVERY …
        setUser(authUser)
        await fetchProfile(authUser)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    setUser(null)
    setProfile(null)
    await supabase.auth.signOut()
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
