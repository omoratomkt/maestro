import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

type Membership = Tables<'workspace_usuarios'>
export interface WorkspaceRef {
  id: string
  nome: string
}

interface AuthState {
  session: Session | null
  loading: boolean
  memberships: Membership[]
  /** Workspaces que o usuário pode ver (super_admin vê todos). */
  workspaces: WorkspaceRef[]
  /** Workspace ativo: tudo no painel (campanhas, pipeline, fila...) é filtrado por ele. */
  workspaceId: string | null
  setWorkspaceId: (id: string) => void
  isSuperAdmin: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const STORAGE_KEY = 'maestro.workspace'

function lerEscolhido(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceRef[]>([])
  const [escolhido, setEscolhido] = useState<string | null>(lerEscolhido)
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
        setWorkspaces([])
        setLoading(false)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let active = true
    ;(async () => {
      const { data: m } = await supabase.from('workspace_usuarios').select('*').eq('user_id', userId)
      const vinculos = m ?? []
      // super_admin enxerga todos os workspaces (RLS); os demais, só os seus.
      const admin = vinculos.some((v) => v.role === 'super_admin')
      const q = supabase.from('workspaces').select('id, nome').order('nome')
      const { data: ws } = admin ? await q : await q.in('id', vinculos.map((v) => v.workspace_id))
      if (!active) return
      setMemberships(vinculos)
      setWorkspaces(ws ?? [])
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [userId])

  const workspaceId =
    workspaces.find((w) => w.id === escolhido)?.id ??
    workspaces.find((w) => w.id === memberships[0]?.workspace_id)?.id ??
    workspaces[0]?.id ??
    null

  const setWorkspaceId = useCallback((id: string) => {
    setEscolhido(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* sem localStorage: vale só nesta sessão */
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      memberships,
      workspaces,
      workspaceId,
      setWorkspaceId,
      isSuperAdmin: memberships.some((m) => m.role === 'super_admin'),
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, loading, memberships, workspaces, workspaceId, setWorkspaceId],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
