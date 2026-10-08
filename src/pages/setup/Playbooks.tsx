import { EmptyState, PageShell } from '@/components/layout/PageShell'

export default function Playbooks() {
  return (
    <PageShell title="Playbooks" description="Biblioteca de templates de campanha">
      <EmptyState message="A biblioteca de playbooks será construída na próxima etapa." />
    </PageShell>
  )
}
