import { Clock, Coins, MessageSquareReply, Send, Target, Users } from 'lucide-react'
import { useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { MetricCard } from '@/components/metrics/MetricCard'
import { PipelineFunnelChart } from '@/components/metrics/PipelineFunnelChart'
import { ResponseRateChart } from '@/components/metrics/ResponseRateChart'
import { EvolutionChart } from '@/components/metrics/EvolutionChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useCampaignComparison, useHistory, useMetrics } from '@/hooks/useMetrics'

const PERIODOS = [7, 30, 90]

function formatHours(h: number | null) {
  if (h === null) return '—'
  return h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} dias`
}

export default function Metrics() {
  const [dias, setDias] = useState(30)
  const [campanhaId, setCampanhaId] = useState<string | null>(null)
  const { campanhas } = useCampaigns()
  const { data, error } = useMetrics(dias, campanhaId)
  const comparativo = useCampaignComparison(dias)
  const historico = useHistory(dias, campanhaId)

  const taxaQualificacao =
    data && data.prospects_processados > 0 ? `${((data.qualificados / data.prospects_processados) * 100).toFixed(1)}%` : '—'

  return (
    <PageShell title="Métricas" description="Volume, respostas, qualificação e custo por lead">
      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className="font-medium">Período</span>
        {PERIODOS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setDias(p)}
            className={`rounded-full border px-3 py-1 ${dias === p ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {p} dias
          </button>
        ))}
        <span className="ml-4 font-medium">Campanha</span>
        <select
          aria-label="Filtrar por campanha"
          className="h-8 rounded-lg border bg-background px-2 text-sm"
          value={campanhaId ?? ''}
          onChange={(e) => setCampanhaId(e.target.value || null)}
        >
          <option value="">Todas</option>
          {campanhas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-destructive">Erro ao carregar métricas: {error}</p> : null}

      {!data && !error ? (
        <Skeleton className="h-64" />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Prospects processados" value={data.prospects_processados} icon={Users} />
            <MetricCard label="Mensagens enviadas" value={data.mensagens_enviadas} icon={Send} hint={`${data.respostas} respostas recebidas`} />
            <MetricCard label="Taxa de qualificação" value={taxaQualificacao} icon={Target} hint={`${data.qualificados} leads qualificados`} />
            <MetricCard label="Tempo médio até qualificação" value={formatHours(data.horas_ate_qualificar)} icon={Clock} />
            <MetricCard
              label="Custo por lead qualificado"
              value={data.custo_por_lead_usd !== null ? `US$ ${Number(data.custo_por_lead_usd).toFixed(2)}` : '—'}
              icon={Coins}
              hint={`Custo de IA no período: US$ ${Number(data.custo_total_usd).toFixed(2)} (APIs de dados não incluídas)`}
            />
            <MetricCard
              label="Respostas / enviadas"
              value={data.mensagens_enviadas > 0 ? `${((data.respostas / data.mensagens_enviadas) * 100).toFixed(1)}%` : '—'}
              icon={MessageSquareReply}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Taxa de resposta por canal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponseRateChart data={data.por_canal} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Funil do pipeline (atual)</CardTitle>
              </CardHeader>
              <CardContent>
                <PipelineFunnelChart data={data.funil} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Evolução (acumulado por dia)</CardTitle>
            </CardHeader>
            <CardContent>{historico ? <EvolutionChart data={historico} /> : <Skeleton className="h-40" />}</CardContent>
          </Card>

          {comparativo && comparativo.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Campanhas lado a lado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Campanha</th>
                        <th className="px-3 py-2 font-medium">Prospects</th>
                        <th className="px-3 py-2 font-medium">Contatados</th>
                        <th className="px-3 py-2 font-medium">Responderam</th>
                        <th className="px-3 py-2 font-medium">Taxa de resposta</th>
                        <th className="px-3 py-2 font-medium">Qualificados</th>
                        <th className="px-3 py-2 font-medium">Custo de IA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparativo.map((c) => (
                        <tr key={c.campanha_id} className="border-t">
                          <td className="px-3 py-2 font-medium">{c.nome}</td>
                          <td className="px-3 py-2">{c.prospects_total}</td>
                          <td className="px-3 py-2">{c.contatados}</td>
                          <td className="px-3 py-2">{c.responderam}</td>
                          <td className="px-3 py-2">{c.contatados > 0 ? `${Math.round((c.responderam / c.contatados) * 100)}%` : '—'}</td>
                          <td className="px-3 py-2">{c.qualificados}</td>
                          <td className="px-3 py-2">US$ {Number(c.custo_usd).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  )
}
