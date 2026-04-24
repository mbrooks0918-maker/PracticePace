import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const OrgContext = createContext(null)

export function OrgProvider({ children }) {
  const { user } = useAuth()
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setOrg(null)
      setLoading(false)
      return
    }

    supabase
      .from('organizations')
      .select('*')
      .eq('owner_id', user.id)
      .single()
      .then(({ data }) => {
        setOrg(data)
        setLoading(false)
      })
  }, [user])

  return (
    <OrgContext.Provider value={{ org, loading }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  return useContext(OrgContext)
}
