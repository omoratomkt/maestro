import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageShell } from '@/components/layout/PageShell'
import { PlaybookEditor } from '@/components/setup/PlaybookEditor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlaybookAdmin, type PlaybookRow } from '@/hooks/usePlaybooks'
import { CANAIS, FONTES, labelOf } from '@/lib/constants'

export default function Playbooks() {
  const { playbooks, loading, error, create, update, remove } = usePlaybookAdmin()
  const [editing, setEditing] = useState<'new' | PlaybookRow | null>(null)

  async function onDelete(p: PlaybookRow) {
    if (!window.confirm(`Excluir o playbook "${p.nome}"? Campanhas já criadas não são afetadas.`)) return
    try {
      await remove(p.id)
      toast.success('Playbook excluído.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir')
    }
  }

  return (
    <PageShell title="Playbooks" description="Biblioteca de templates de campanha">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing('new')}>
          <Plus /> Novo playbook
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">Erro ao carregar playbooks: {error}</p> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {playbooks.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="leading-snug">{p.nome}</CardTitle>
                  {!p.ativo ? <Badge variant="secondary">Inativo</Badge> : null}
                </div>
                {p.descricao ? <p className="text-xs text-muted-foreground">{p.descricao}</p> : null}
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex flex-wrap gap-1">
                  {(p.fontes_padrao ?? []).map((v) => (
                    <Badge key={v} variant="secondary">
                      {labelOf(FONTES, v)}
                    </Badge>
                  ))}
                  {(p.canais_padrao ?? []).map((v) => (
                    <Badge key={v} variant="outline">
                      {labelOf(CANAIS, v)}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    <Pencil /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(p)}>
                    <Trash2 /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {playbooks.length === 0 && !error ? (
            <p className="text-sm text-muted-foreground">Nenhum playbook cadastrado.</p>
          ) : null}
        </div>
      )}

      {editing ? (
        <PlaybookEditor
          playbook={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(input) => (editing === 'new' ? create(input) : update(editing.id, input))}
        />
      ) : null}
    </PageShell>
  )
}
