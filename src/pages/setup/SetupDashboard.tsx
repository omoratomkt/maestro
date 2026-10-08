import { EmptyState, PageShell } from '@/components/layout/PageShell'

export default function SetupDashboard() {
  return (
    <PageShell title="Setup" description="Visão geral da administração do Maestro">
      <EmptyState message="O painel de setup será construído na próxima etapa." />
    </PageShell>
  )
}
