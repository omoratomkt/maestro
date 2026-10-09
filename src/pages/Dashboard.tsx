import { Flame, MessageSquareReply, Radar, Send, ShieldCheck, Target, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageShell } from '@/components/layout/PageShell'
import { MetricCard } from '@/components/metrics/MetricCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { descreverAlerta, TIPOS_ALERTA, useAlertas } from '@/hooks/useAlertas'
import { useDashboard } from '@/hooks/useDashboard'

export default function Dashboard() {
  const { data, error } = useDashboard()
  const { alertas, marcarVisto, marcarTodos } = useAlertas()

  return (
    <PageShell title="Dashboard" description="Métricas do dia, fila pendente e leads quentes">
      {error ? <p className="mb-4 text-sm text-destructive">Erro ao carregar métricas: {error}</p> : null}

      {!data && !error ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Pendentes na fila" value={data.pendentes} icon={ShieldCheck} hint="aguardando sua aprovação" />
            <MetricCard label="Prospects novos hoje" value={data.novosHoje} icon={UserPlus} />
            <MetricCard label="Mensagens enviadas hoje" value={data.enviadasHoje} icon={Send} />
            <MetricCard label="Respostas hoje" value={data.respostasHoje} icon={MessageSquareReply} />
            <MetricCard label="Qualificados hoje" value={data.qualificadosHoje} icon={Target} />
          </div>

          {data.pendentes > 0 ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3 text-sm">
              <span>
                {data.pendentes} {data.pendentes === 1 ? 'ação aguarda' : 'ações aguardam'} sua aprovação.
              </span>
              <Button size="sm" render={<Link to="/fila" />}>
                Abrir fila
              </Button>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="size-4" /> Leads quentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.leadsQuentes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lead qualificado aguardando reunião.</p>
              ) : (
                <ul className="divide-y">
                  {data.leadsQuentes.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{l.prospects?.nome_empresa ?? 'Prospect removido'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[l.prospects?.nome_contato, l.prospects?.cargo].filter(Boolean).join(' · ')}
                          {l.proximo_passo ? ` — ${l.proximo_passo}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline">{l.status_reuniao}</Badge>
                        {l.score_temperatura !== null ? <Badge>{l.score_temperatura}/10</Badge> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {alertas.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Radar className="size-4" /> Sinais de timing
                  </span>
                  <Button size="sm" variant="ghost" onClick={marcarTodos}>
                    Marcar todos como vistos
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {alertas.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {a.prospects?.nome_empresa ?? 'Prospect removido'} <Badge variant="secondary">{TIPOS_ALERTA[a.tipo] ?? a.tipo}</Badge>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{descreverAlerta(a)}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => marcarVisto(a.id)}>
                        Visto
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  )
}
