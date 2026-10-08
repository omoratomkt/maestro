import { EmptyState, PageShell } from '@/components/layout/PageShell'

export default function Queue() {
  return (
    <PageShell title="Fila de Supervisão" description="Ações propostas pelo agente aguardando aprovação">
      <EmptyState message="A fila de supervisão será construída com dados reais na próxima etapa." />
    </PageShell>
  )
}
