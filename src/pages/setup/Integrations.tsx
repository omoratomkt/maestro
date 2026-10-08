import { EmptyState, PageShell } from '@/components/layout/PageShell'

export default function Integrations() {
  return (
    <PageShell title="Integrações" description="APIs e credenciais por workspace">
      <EmptyState message="A configuração de integrações será construída na próxima etapa." />
    </PageShell>
  )
}
