import { EmptyState, PageShell } from '@/components/layout/PageShell'

export default function Workspaces() {
  return (
    <PageShell title="Workspaces" description="Clientes, planos e usuários">
      <EmptyState message="A gestão de workspaces será construída na próxima etapa." />
    </PageShell>
  )
}
