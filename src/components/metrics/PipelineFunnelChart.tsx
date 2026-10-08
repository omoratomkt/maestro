import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MetricsSummary } from '@/hooks/useMetrics'
import { ALL_PROSPECT_STATUS, labelOf } from '@/lib/constants'

export function PipelineFunnelChart({ data }: { data: MetricsSummary['funil'] }) {
  const order = ALL_PROSPECT_STATUS.map((s) => s.value as string)
  const rows = [...data]
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))
    .map((r) => ({ status: labelOf(ALL_PROSPECT_STATUS, r.status), total: r.total }))
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">Sem prospects no pipeline.</p>
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="status" width={90} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => [v, 'Prospects']} />
        <Bar dataKey="total" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
