import { EmptyState, PageShell } from '@/components/layout/PageShell'

export default function Pipeline() {
  return (
    <PageShell title="Pipeline" description="Prospects por status, do novo ao convertido">
      <EmptyState message="O pipeline será construído com dados reais na próxima etapa." />
    </PageShell>
  )
}
