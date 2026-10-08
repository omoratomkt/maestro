import { EmptyState, PageShell } from '@/components/layout/PageShell'

export default function Metrics() {
  return (
    <PageShell title="Métricas" description="Volume, respostas, qualificação e custo por lead">
      <EmptyState message="As métricas serão construídas com dados reais na próxima etapa." />
    </PageShell>
  )
}
