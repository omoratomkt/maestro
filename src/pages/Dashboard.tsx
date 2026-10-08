import { EmptyState, PageShell } from '@/components/layout/PageShell'

export default function Dashboard() {
  return (
    <PageShell title="Dashboard" description="Métricas do dia, fila pendente e leads quentes">
      <EmptyState message="O dashboard será construído com dados reais na próxima etapa." />
    </PageShell>
  )
}
