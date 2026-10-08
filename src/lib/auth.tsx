import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

type Membership = Tables<'workspace_usuarios'>

interface AuthState {
  session: Session | null
  loading: boolean
  memberships: Membership[]
  /** Workspace ativo (primeiro vínculo do usuário). */
  workspaceId: string | null
  isSuperAdmin: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) {
        setMemberships([])
        setLoading(false)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let active = true
    supabase
      .from('workspace_usuarios')
      .select('*')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (!active) return
        setMemberships(data ?? [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId])

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      memberships,
      workspaceId: memberships[0]?.workspace_id ?? null,
      isSuperAdmin: memberships.some((m) => m.role === 'super_admin'),
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, loading, memberships],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
