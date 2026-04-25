import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  // Use profile (not just user) — profile has org_id which is the correct
  // foreign key to look up the organization row.
  const { profile } = useAuth()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.org_id) {
      setOrg(null)
      setLoading(false)
      return
    }

    supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.org_id)   // correct: match organizations.id to profile.org_id
      .single()
      .then(({ data, error }) => {
        if (error) console.error('OrgContext fetch error:', error.message)
        setOrg(data ?? null)
        setLoading(false)
      })
  }, [profile?.org_id])

  return (
    <OrgContext.Provider value={{ org, loading }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  return useContext(OrgContext)
}
