import { EmptyState, PageShell } from '@/components/layout/PageShell'

export default function Inbox() {
  return (
    <PageShell title="Caixa de Entrada" description="Respostas recebidas em todos os canais">
      <EmptyState message="A caixa de entrada será construída com dados reais na próxima etapa." />
    </PageShell>
  )
}
