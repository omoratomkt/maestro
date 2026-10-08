import { EmptyState, PageShell } from '@/components/layout/PageShell'

export default function Automations() {
  return (
    <PageShell title="Automações" description="Fluxos promovidos para execução automática">
      <EmptyState message="As automações serão construídas com dados reais na próxima etapa." />
    </PageShell>
  )
}
