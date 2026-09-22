import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function restoreSession() {
      const { data: sessionData } = await supabase.auth.getSession()
      const savedSession = sessionData.session

      if (!savedSession) {
        if (active) {
          setSession(null)
          setLoading(false)
        }
        return
      }

      // getUser validates the saved access token with Supabase instead of
      // trusting browser storage alone.
      const { data: userData, error } = await supabase.auth.getUser()
      if (!active) return

      if (error || !userData.user) {
        await supabase.auth.signOut({ scope: 'local' })
        if (active) setSession(null)
      } else {
        const { data: latestSessionData } = await supabase.auth.getSession()
        if (active) setSession(latestSessionData.session)
      }
      if (active) setLoading(false)
    }

    void restoreSession()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } finally {
      setSession(null)
    }
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
