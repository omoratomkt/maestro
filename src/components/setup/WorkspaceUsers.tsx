import { Mail, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { callFunction } from '@/lib/functions'
import type { Tables } from '@/types/database'

interface Usuario {
  user_id: string
  role: string
  email: string | null
  ultimo_acesso: string | null
  convite_pendente: boolean
  voce: boolean
}

const ROLES = [
  { value: 'operador', label: 'Operador' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super admin' },
]

/** Usuários de um workspace: lista, convida por email, troca o papel e remove (Edge Function admin-users). */
export function WorkspaceUsers({ workspace, onClose }: { workspace: Tables<'workspaces'>; onClose: () => void }) {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('operador')
  const [busy, setBusy] = useState(false)

  const call = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await callFunction<{ usuarios?: Usuario[]; convite_enviado?: boolean }>('admin-users', { workspace_id: workspace.id, ...body })
      if (!r.ok) throw new Error(r.error ?? 'Erro')
      return r.data!
    },
    [workspace.id],
  )

  const load = useCallback(async () => {
    try {
      setUsuarios((await call({ action: 'listar' })).usuarios ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao listar usuários')
      setUsuarios([])
    }
  }, [call])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function convidar(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await call({ action: 'convidar', email, role, redirect_to: `${window.location.origin}/definir-senha` })
      toast.success(r.convite_enviado ? `Convite enviado para ${email}.` : `${email} já tinha conta e foi vinculado ao workspace.`)
      setEmail('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao convidar')
    } finally {
      setBusy(false)
    }
  }

  async function run(body: Record<string, unknown>, ok: string) {
    try {
      await call(body)
      toast.success(ok)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Usuários de {workspace.nome}</DialogTitle>
          <DialogDescription>Operador usa o painel; admin e super admin também configuram. O convite chega por email.</DialogDescription>
        </DialogHeader>

        <form onSubmit={convidar} className="flex gap-2">
          <Input type="email" required placeholder="email@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="h-8 rounded-lg border bg-background px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={busy}>
            <Mail /> Convidar
          </Button>
        </form>

        <ul className="divide-y rounded-lg border text-xs">
          {usuarios === null ? <li className="px-3 py-3 text-muted-foreground">Carregando…</li> : null}
          {usuarios?.length === 0 ? <li className="px-3 py-3 text-muted-foreground">Nenhum usuário vinculado.</li> : null}
          {usuarios?.map((u) => (
            <li key={u.user_id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {u.email ?? u.user_id}
                  {u.voce ? ' (você)' : ''}
                </p>
                <p className="text-muted-foreground">
                  {u.convite_pendente ? 'Convite pendente' : u.ultimo_acesso ? `Último acesso ${new Date(u.ultimo_acesso).toLocaleDateString('pt-BR')}` : 'Nunca acessou'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <select
                  className="h-8 rounded-lg border bg-background px-2 text-sm"
                  value={u.role}
                  disabled={u.voce}
                  onChange={(e) => run({ action: 'alterar_papel', user_id: u.user_id, role: e.target.value }, 'Papel atualizado.')}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remover usuário"
                  disabled={u.voce}
                  onClick={() => window.confirm(`Remover ${u.email} deste workspace?`) && run({ action: 'remover', user_id: u.user_id }, 'Usuário removido.')}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
