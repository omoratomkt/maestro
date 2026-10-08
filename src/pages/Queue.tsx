import { QueueItem } from '@/components/queue/QueueItem'
import { EmptyState, PageShell } from '@/components/layout/PageShell'
import { Skeleton } from '@/components/ui/skeleton'
import { useQueue } from '@/hooks/useQueue'

export default function Queue() {
  const { items, loading, error, approve, reject, automate } = useQueue()

  return (
    <PageShell title="Fila de Supervisão" description="Ações propostas pelo agente aguardando aprovação">
      {error ? <p className="text-sm text-destructive">Erro ao carregar a fila: {error}</p> : null}
      {loading ? (
        <Skeleton className="h-48" />
      ) : items.length === 0 && !error ? (
        <EmptyState message="Nenhuma ação pendente. Quando o agente propuser algo, aparece aqui." />
      ) : (
        <div className="mx-auto max-w-2xl space-y-4">
          {items.map((item) => (
            <QueueItem key={item.id} item={item} onApprove={approve} onReject={reject} onAutomate={automate} />
          ))}
        </div>
      )}
    </PageShell>
  )
}
