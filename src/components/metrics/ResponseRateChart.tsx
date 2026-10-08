import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MetricsSummary } from '@/hooks/useMetrics'
import { CANAIS_INTERACAO, labelOf } from '@/lib/constants'

export function ResponseRateChart({ data }: { data: MetricsSummary['por_canal'] }) {
  const rows = data.map((c) => ({
    canal: labelOf(CANAIS_INTERACAO, c.canal),
    taxa: c.contatados > 0 ? Math.round((c.responderam / c.contatados) * 100) : 0,
    contatados: c.contatados,
    responderam: c.responderam,
  }))
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">Sem interações no período.</p>
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="canal" tick={{ fontSize: 12 }} />
        <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(v) => [`${v}%`, 'Taxa de resposta']}
          labelFormatter={(label, items) => {
            const p = items?.[0]?.payload as (typeof rows)[number] | undefined
            return p ? `${label}: ${p.responderam} de ${p.contatados} contatados` : String(label)
          }}
        />
        <Bar dataKey="taxa" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
