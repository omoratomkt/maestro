import { format } from 'date-fns'
import { Pause, Play } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, PageShell } from '@/components/layout/PageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAutomations } from '@/hooks/useAutomations'
import { CANAIS, labelOf } from '@/lib/constants'

export default function Automations() {
  const { fluxos, log, loading, error, setAtivo } = useAutomations()

  async function toggle(id: string, ativo: boolean) {
    try {
      await setAtivo(id, ativo)
      toast.success(ativo ? 'Fluxo reativado.' : 'Fluxo pausado.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar o fluxo')
    }
  }

  return (
    <PageShell title="Automações" description="Fluxos promovidos para execução automática">
      {error ? <p className="text-sm text-destructive">Erro ao carregar automações: {error}</p> : null}
      {loading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            {fluxos.length === 0 && !error ? (
              <EmptyState message='Nenhum fluxo automático ainda. Use "Automatizar este padrão" na Fila de Supervisão.' />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {fluxos.map((f) => (
                  <Card key={f.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="leading-snug">{f.nome}</CardTitle>
                        <Badge variant={f.ativo ? 'default' : 'secondary'}>{f.ativo ? 'Ativo' : 'Pausado'}</Badge>
                      </div>
                      {f.descricao ? <p className="text-xs text-muted-foreground">{f.descricao}</p> : null}
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2">{f.template_mensagem}</p>
                      <dl className="grid grid-cols-3 gap-2">
                        <div>
                          <dt className="text-muted-foreground">Canal</dt>
                          <dd className="font-medium">{labelOf(CANAIS, f.canal_acao)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Execuções</dt>
                          <dd className="font-medium">{f.total_execucoes ?? 0}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Sucesso</dt>
                          <dd className="font-medium">{f.taxa_sucesso !== null ? `${f.taxa_sucesso}%` : '—'}</dd>
                        </div>
                      </dl>
                      <Button size="sm" variant="outline" onClick={() => toggle(f.id, !f.ativo)}>
                        {f.ativo ? (
                          <>
                            <Pause /> Pausar
                          </>
                        ) : (
                          <>
                            <Play /> Reativar
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Log das últimas 24h</h2>
            {log.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma execução automática nas últimas 24 horas.</p>
            ) : (
              <ul className="divide-y rounded-lg border text-xs">
                {log.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="truncate">
                      <b>{a.prospects?.nome_empresa ?? 'Prospect removido'}</b> — {a.tipo} via {labelOf(CANAIS, a.canal)}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                      <Badge variant={a.erro_execucao ? 'destructive' : 'outline'}>{a.erro_execucao ? 'erro' : a.status}</Badge>
                      {format(new Date(a.criado_em), 'dd/MM HH:mm')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </PageShell>
  )
}
