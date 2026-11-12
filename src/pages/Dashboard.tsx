import { Flame, MessageSquareReply, Radar, Send, ShieldCheck, Target, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageShell } from '@/components/layout/PageShell'
import { MetricCard } from '@/components/metrics/MetricCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { descreverAlerta, TIPOS_ALERTA, useAlertas } from '@/hooks/useAlertas'
import { useDashboard } from '@/hooks/useDashboard'
import { DASHBOARD_DEMO, demoLigada, gravarDemo } from '@/lib/dashboardDemo'

interface LeadQuenteView {
  id: string
  empresa: string
  contato: string
  proximoPasso: string
  statusReuniao: string | null
  score: number | null
}

export default function Dashboard() {
  const { data: real, error } = useDashboard()
  const { alertas, marcarVisto, marcarTodos } = useAlertas()
  // Demonstração: números inventados para mostrar o Maestro em uso pleno. O interruptor abaixo volta aos dados reais.
  const [demo, setDemo] = useState(demoLigada)
  const alternarDemo = () => {
    gravarDemo(!demo)
    setDemo(!demo)
  }
  const data = demo ? DASHBOARD_DEMO : real
  const leadsQuentes: LeadQuenteView[] = demo
    ? DASHBOARD_DEMO.leadsQuentes.map((l) => ({ id: l.id, empresa: l.empresa, contato: l.contato, proximoPasso: l.proximoPasso, statusReuniao: l.statusReuniao, score: l.score }))
    : (real?.leadsQuentes ?? []).map((l) => ({
        id: l.id,
        empresa: l.prospects?.nome_empresa ?? 'Prospect removido',
        contato: [l.prospects?.nome_contato, l.prospects?.cargo].filter(Boolean).join(' · '),
        proximoPasso: l.proximo_passo ?? '',
        statusReuniao: l.status_reuniao,
        score: l.score_temperatura,
      }))

  return (
    <PageShell title="Dashboard" description="Métricas do dia, fila pendente e leads quentes">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{demo ? 'Números de demonstração: o Maestro em uso pleno.' : 'Mostrando os dados reais do workspace.'}</span>
        <Button type="button" variant="ghost" size="sm" onClick={alternarDemo}>
          {demo ? 'Ver dados reais' : 'Ver demonstração'}
        </Button>
      </div>
      {error && !demo ? <p className="mb-4 text-sm text-destructive">Erro ao carregar métricas: {error}</p> : null}

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
              {leadsQuentes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lead qualificado aguardando reunião.</p>
              ) : (
                <ul className="divide-y">
                  {leadsQuentes.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{l.empresa}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {l.contato}
                          {l.proximoPasso ? ` · ${l.proximoPasso}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {l.statusReuniao ? <Badge variant="outline">{l.statusReuniao}</Badge> : null}
                        {l.score !== null ? <Badge variant="destaque">{l.score}/10</Badge> : null}
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
