import { RotateCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, PageShell } from '@/components/layout/PageShell'
import { QueueItem } from '@/components/queue/QueueItem'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useQueue, type FilaAcao } from '@/hooks/useQueue'
import { canalLabel } from '@/lib/constants'

export default function Queue() {
  const { items, falhas, loading, error, approve, reject, automate, retry, cancel } = useQueue()

  async function onRetry(a: FilaAcao) {
    const r = await retry(a)
    if (r.enviado) toast.success('Mensagem enviada.')
    else toast.error(`Envio falhou de novo: ${r.detalhe}`, { duration: 9000 })
  }

  return (
    <PageShell title="Fila de Supervisão" description="Ações propostas pelo agente aguardando aprovação">
      {error ? <p className="text-sm text-destructive">Erro ao carregar a fila: {error}</p> : null}
      {loading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="mx-auto max-w-2xl space-y-6">
          {falhas.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-destructive">Falhas de envio ({falhas.length})</h2>
              {falhas.map((a) => (
                <div key={a.id} className="space-y-2 rounded-lg border border-destructive/40 p-3 text-xs">
                  <p className="font-medium">
                    {a.prospects?.nome_empresa ?? 'Prospect removido'} — {a.tipo} via {canalLabel(a.canal)}
                  </p>
                  <p className="whitespace-pre-wrap rounded bg-muted px-2 py-1.5">{a.mensagem_editada ?? a.mensagem}</p>
                  <p className="text-destructive">{a.erro_execucao}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => onRetry(a)}>
                      <RotateCw /> Tentar de novo
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => cancel(a).catch((e) => toast.error(e.message))}>
                      <X /> Cancelar ação
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {items.length === 0 && !error ? (
            <EmptyState message="Nenhuma ação pendente. Quando o agente propuser algo, aparece aqui." />
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <QueueItem key={item.id} item={item} onApprove={approve} onReject={reject} onAutomate={automate} />
              ))}
            </div>
          )}
        </div>
      )}
    </PageShell>
  )
}
