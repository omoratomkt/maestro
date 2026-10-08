import { Clock, Coins, MessageSquareReply, Send, Target, Users } from 'lucide-react'
import { useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { MetricCard } from '@/components/metrics/MetricCard'
import { PipelineFunnelChart } from '@/components/metrics/PipelineFunnelChart'
import { ResponseRateChart } from '@/components/metrics/ResponseRateChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMetrics } from '@/hooks/useMetrics'

const PERIODOS = [7, 30, 90]

function formatHours(h: number | null) {
  if (h === null) return '—'
  return h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} dias`
}

export default function Metrics() {
  const [dias, setDias] = useState(30)
  const { data, error } = useMetrics(dias)

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
              value="—"
              icon={Coins}
              hint="Aguardando registro de custo (tokens de IA e APIs), ainda não coletado"
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
        </div>
      ) : null}
    </PageShell>
  )
}
