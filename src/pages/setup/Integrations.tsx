import { useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { IntegrationForm } from '@/components/setup/IntegrationForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useIntegrations, useWorkspaces } from '@/hooks/useIntegrations'
import { INTEGRATION_GROUPS, INTEGRATIONS, type IntegrationDef } from '@/lib/integrations'

export default function Integrations() {
  const { workspaces, loading: loadingWs } = useWorkspaces()
  const [chosen, setChosen] = useState<string | null>(null)
  const workspaceId = chosen ?? workspaces[0]?.id ?? null
  const { items, loading, error, save, remove } = useIntegrations(workspaceId)
  const [editing, setEditing] = useState<IntegrationDef | null>(null)

  return (
    <PageShell title="Integrações" description="APIs e credenciais por workspace">
      <div className="mb-6 flex items-center gap-2 text-sm">
        <label className="text-xs font-medium">Workspace</label>
        <select
          className="h-8 rounded-lg border bg-background px-2.5 text-sm"
          value={workspaceId ?? ''}
          onChange={(e) => setChosen(e.target.value)}
          disabled={loadingWs}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.nome}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">Erro ao carregar integrações: {error}</p> : null}

      <div className="space-y-6">
        {INTEGRATION_GROUPS.map((group) => (
          <section key={group} className="space-y-3">
            <h2 className="text-sm font-semibold">{group}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {INTEGRATIONS.filter((d) => d.group === group).map((def) => {
                const current = items.find((i) => i.tipo === def.tipo)
                return (
                  <Card key={def.tipo}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm">{def.label}</CardTitle>
                        {current ? (
                          <Badge variant={current.ativo ? 'default' : 'secondary'}>{current.ativo ? 'Ativa' : 'Inativa'}</Badge>
                        ) : (
                          <Badge variant="outline">Não configurada</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button size="sm" variant="outline" disabled={!workspaceId || loading} onClick={() => setEditing(def)}>
                        {current ? 'Editar' : 'Configurar'}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {editing ? (
        <IntegrationForm
          key={editing.tipo}
          def={editing}
          current={items.find((i) => i.tipo === editing.tipo)}
          onClose={() => setEditing(null)}
          onSave={(config, ativo) => save(editing.tipo, config, ativo)}
          onRemove={async () => {
            const cur = items.find((i) => i.tipo === editing.tipo)
            if (cur) await remove(cur.id)
          }}
        />
      ) : null}
    </PageShell>
  )
}
