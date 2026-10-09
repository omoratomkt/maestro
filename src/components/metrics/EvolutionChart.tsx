import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HistoryPoint } from '@/hooks/useMetrics'

/** Valores acumulados por dia (fotos diárias das campanhas). */
export function EvolutionChart({ data }: { data: HistoryPoint[] }) {
  if (data.length < 2) {
    return <p className="text-xs text-muted-foreground">O histórico começa a aparecer depois de dois dias de operação: uma foto das métricas é guardada a cada hora.</p>
  }
  const rows = data.map((p) => ({ ...p, dia: p.dia.slice(8, 10) + '/' + p.dia.slice(5, 7) }))
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="mensagens_enviadas" name="Mensagens enviadas" stroke="var(--color-muted-foreground)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="respostas" name="Respostas" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="qualificados" name="Qualificados" stroke="var(--color-destructive)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
