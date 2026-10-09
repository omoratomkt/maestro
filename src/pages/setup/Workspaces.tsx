import { Download, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/campaigns/NewCampaignWizard/fields'
import { PageShell } from '@/components/layout/PageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { WorkspaceUsers } from '@/components/setup/WorkspaceUsers'
import { baixarDadosDoWorkspace, excluirWorkspace } from '@/lib/exportWorkspace'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

type Workspace = Tables<'workspaces'>

const PLANOS = ['demo', 'starter', 'pro'] as const

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function WorkspaceDialog({ workspace, onClose, onSaved }: { workspace?: Workspace; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(workspace?.nome ?? '')
  const [slug, setSlug] = useState(workspace?.slug ?? '')
  const [plano, setPlano] = useState(workspace?.plano ?? 'starter')
  const [ativo, setAtivo] = useState(workspace?.ativo ?? true)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!nome.trim() || !slug.trim()) return toast.error('Informe nome e slug.')
    setSaving(true)
    const payload = { nome: nome.trim(), slug: slug.trim(), plano, ativo, atualizado_em: new Date().toISOString() }
    const { error } = workspace
      ? await supabase.from('workspaces').update(payload).eq('id', workspace.id)
      : await supabase.from('workspaces').insert(payload)
    setSaving(false)
    if (error) return toast.error(error.message.includes('duplicate') ? 'Já existe um workspace com esse slug.' : error.message)
    toast.success('Workspace salvo.')
    onSaved()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{workspace ? 'Editar workspace' : 'Novo workspace'}</DialogTitle>
          <DialogDescription>Um workspace por cliente. Isola todos os dados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nome">
            <Input
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                if (!workspace) setSlug(slugify(e.target.value))
              }}
            />
          </Field>
          <Field label="Slug" hint="Identificador único, sem espaços.">
            <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
          </Field>
          <Field label="Plano">
            <select className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm" value={plano} onChange={(e) => setPlano(e.target.value)}>
              {PLANOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDialog({ workspace, onClose, onDeleted }: { workspace: Workspace; onClose: () => void; onDeleted: () => void }) {
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirmar() {
    setBusy(true)
    try {
      await excluirWorkspace(workspace.id)
      toast.success('Workspace excluído.')
      onDeleted()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir {workspace.nome}</DialogTitle>
          <DialogDescription>
            Apaga para sempre o workspace e tudo que é dele: campanhas, prospects, conversas, fila, leads, métricas e integrações. Não dá para desfazer. Baixe os dados antes, se o cliente precisar deles.
          </DialogDescription>
        </DialogHeader>
        <Field label={`Digite "${workspace.slug}" para confirmar`}>
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={busy || texto !== workspace.slug}>
            Excluir definitivamente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Workspaces() {
  const [items, setItems] = useState<Workspace[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<'new' | Workspace | null>(null)
  const [usersOf, setUsersOf] = useState<Workspace | null>(null)
  const [deleting, setDeleting] = useState<Workspace | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  async function exportar(w: Workspace) {
    setExporting(w.id)
    try {
      await baixarDadosDoWorkspace(w.id, w.slug)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao exportar.')
    } finally {
      setExporting(null)
    }
  }

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('workspaces').select('*').order('criado_em')
    if (err) setError(err.message)
    else setItems(data)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  return (
    <PageShell title="Workspaces" description="Clientes, planos e usuários">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing('new')}>
          <Plus /> Novo workspace
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">Erro ao carregar workspaces: {error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((w) => (
          <Card key={w.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{w.nome}</CardTitle>
                <Badge variant={w.ativo ? 'default' : 'secondary'}>{w.ativo ? 'Ativo' : 'Inativo'}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {w.slug} · plano {w.plano}
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(w)}>
                <Pencil /> Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setUsersOf(w)}>
                <Users /> Usuários
              </Button>
              <Button size="sm" variant="outline" disabled={exporting === w.id} onClick={() => void exportar(w)}>
                <Download /> {exporting === w.id ? 'Exportando…' : 'Exportar dados'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDeleting(w)}>
                <Trash2 /> Excluir
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {deleting ? <DeleteDialog workspace={deleting} onClose={() => setDeleting(null)} onDeleted={load} /> : null}
      {usersOf ? <WorkspaceUsers workspace={usersOf} onClose={() => setUsersOf(null)} /> : null}
      {editing ? (
        <WorkspaceDialog workspace={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={load} />
      ) : null}
    </PageShell>
  )
}
