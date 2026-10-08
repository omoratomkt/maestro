import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

function Loading() {
  return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Carregando…</div>
}

/** Exige usuário autenticado. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

/** Exige role super_admin (rotas /setup). */
export function RequireSuperAdmin() {
  const { isSuperAdmin, loading } = useAuth()
  if (loading) return <Loading />
  if (!isSuperAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
