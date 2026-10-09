import { Activity, Building2, Megaphone, Plug, Workflow } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { MetricCard } from '@/components/metrics/MetricCard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTableChanges } from '@/lib/realtime'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

type Ciclo = Tables<'ciclo_log'>
interface Resumo {
  expiradas?: number
  inseridos?: number
  enriquecidos?: number
  enviadas?: number
  decisoes?: number
  erros?: { etapa?: string; erro?: string; prospect_id?: string }[]
}

// O agent-loop roda a cada 15 min; mais de 40 min sem rodada indica problema (cron parado, segredo errado, função com erro).
const ATRASO_ALERTA_MIN = 40

export default function SetupDashboard() {
  const [counts, setCounts] = useState<number[] | null>(null)
  const [ciclos, setCiclos] = useState<Ciclo[] | null>(null)
  const [tick, setTick] = useState(0)
  const [agora, setAgora] = useState(0) // atualizado fora da renderização (Date.now é impuro)
  useTableChanges(['ciclo_log'], () => setTick((t) => t + 1))

  useEffect(() => {
    let active = true
    const h = { count: 'exact' as const, head: true }
    Promise.all([
      supabase.from('workspaces').select('id', h).eq('ativo', true),
      supabase.from('playbooks').select('id', h).eq('ativo', true),
      supabase.from('campanhas').select('id', h).eq('status', 'ativa'),
      supabase.from('integracoes').select('id', h).eq('ativo', true),
    ]).then((r) => active && setCounts(r.map((x) => x.count ?? 0)))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    supabase
      .from('ciclo_log')
      .select('*')
      .order('executado_em', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!active) return
        setCiclos(data ?? [])
        setAgora(Date.now())
      })
    return () => {
      active = false
    }
  }, [tick])

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  const ultimo = ciclos?.[0]
  const minutos = ultimo && agora ? Math.max(0, Math.round((agora - new Date(ultimo.executado_em).getTime()) / 60000)) : null
  const atrasado = ciclos !== null && (minutos === null || minutos > ATRASO_ALERTA_MIN)

  return (
    <PageShell title="Setup" description="Visão geral da administração do Maestro">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Workspaces ativos" value={counts?.[0] ?? '—'} icon={Building2} />
          <MetricCard label="Playbooks ativos" value={counts?.[1] ?? '—'} icon={Workflow} />
          <MetricCard label="Campanhas ativas" value={counts?.[2] ?? '—'} icon={Megaphone} />
          <MetricCard label="Integrações ativas" value={counts?.[3] ?? '—'} icon={Plug} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" /> Ciclo do agente
              {ciclos === null ? null : atrasado ? (
                <Badge variant="destructive">{minutos === null ? 'nenhuma rodada registrada' : `parado há ${minutos} min`}</Badge>
              ) : (
                <Badge>ok — última rodada há {minutos} min</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {atrasado ? (
              <p className="mb-3 text-xs text-destructive">
                O agent-loop deveria rodar a cada 15 minutos. Veja a aba Actions do repositório (agent-loop) e confira o segredo CRON_SECRET.
              </p>
            ) : null}
            {ciclos && ciclos.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Quando</th>
                      <th className="px-3 py-2 font-medium">Tipo</th>
                      <th className="px-3 py-2 font-medium">Decisões</th>
                      <th className="px-3 py-2 font-medium">Enviadas</th>
                      <th className="px-3 py-2 font-medium">Enriquecidos</th>
                      <th className="px-3 py-2 font-medium">Novos prospects</th>
                      <th className="px-3 py-2 font-medium">Duração</th>
                      <th className="px-3 py-2 font-medium">Erros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ciclos.map((c) => {
                      const r = c.resumo as Resumo
                      return (
                        <tr key={c.id} className="border-t align-top">
                          <td className="px-3 py-2">{new Date(c.executado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td className="px-3 py-2">{c.followup ? 'follow-up' : 'rotina'}</td>
                          <td className="px-3 py-2">{r.decisoes ?? 0}</td>
                          <td className="px-3 py-2">{r.enviadas ?? 0}</td>
                          <td className="px-3 py-2">{r.enriquecidos ?? 0}</td>
                          <td className="px-3 py-2">{r.inseridos ?? 0}</td>
                          <td className="px-3 py-2">{(c.duracao_ms / 1000).toFixed(1)} s</td>
                          <td className="px-3 py-2">
                            {c.erros === 0 ? (
                              '—'
                            ) : (
                              <details>
                                <summary className="cursor-pointer text-destructive">{c.erros}</summary>
                                <ul className="mt-1 space-y-1 text-muted-foreground">
                                  {(r.erros ?? []).map((e, i) => (
                                    <li key={i}>
                                      {e.etapa}: {e.erro}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : ciclos ? (
              <p className="text-xs text-muted-foreground">Nenhuma rodada registrada ainda.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
