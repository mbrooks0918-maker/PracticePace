import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)   // { id, account_id, org_id, role, full_name, email }
  const [loading, setLoading] = useState(true)

  // Fetch the profile row for an authenticated (non-anonymous) user.
  // Anonymous / guest users never have a profile row — that's fine.
  async function fetchProfile(authUser) {
    if (!authUser || authUser.is_anonymous) {
      setProfile(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, account_id, org_id, role, full_name, email')
      .eq('id', authUser.id)
      .single()
    setProfile(data ?? null)
  }

  useEffect(() => {
    // 1. Restore existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      await fetchProfile(authUser)
      setLoading(false)
    })

    // 2. Keep in sync with every auth state change (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      await fetchProfile(authUser)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
