import { useMemo, useRef, useState } from 'react'
import { ConversationThread } from '@/components/inbox/ConversationThread'
import { InboxList } from '@/components/inbox/InboxList'
import { EmptyState, PageShell } from '@/components/layout/PageShell'
import { Skeleton } from '@/components/ui/skeleton'
import { useInbox } from '@/hooks/useInbox'
import { useProspectDetail } from '@/hooks/useProspects'

export default function Inbox() {
  const { messages, loading, error, truncated } = useInbox()
  const [selected, setSelected] = useState<string | null>(null)
  const { interacoes, loading: loadingThread } = useProspectDetail(selected)
  const current = messages.find((m) => m.prospect_id === selected)
  const [onlyOpen, setOnlyOpen] = useState(false)
  const conversaRef = useRef<HTMLDivElement>(null)
  const visible = useMemo(() => (onlyOpen ? messages.filter((m) => m.estado !== 'respondida') : messages), [messages, onlyOpen])

  return (
    <PageShell title="Caixa de Entrada" description="Respostas recebidas em todos os canais">
      {error ? <p className="text-sm text-destructive">Erro ao carregar a caixa de entrada: {error}</p> : null}
      {loading ? (
        <Skeleton className="h-64" />
      ) : messages.length === 0 && !error ? (
        <EmptyState message="Nenhuma resposta recebida ainda." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-2">
            <div className="flex gap-2 text-xs">
              {[false, true].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setOnlyOpen(v)}
                  className={`rounded-full border px-3 py-1 ${onlyOpen === v ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  {v ? 'Aguardam resposta' : 'Todas'}
                </button>
              ))}
            </div>
            {truncated ? <p className="text-xs text-muted-foreground">Mostrando as respostas mais recentes.</p> : null}
            <InboxList messages={visible} selectedProspectId={selected} onSelect={(m) => {
                setSelected(m.prospect_id)
                // No celular a conversa fica abaixo da lista: leva a tela até ela.
                if (window.matchMedia('(max-width: 1023px)').matches) setTimeout(() => conversaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
              }} />
          </div>
          <div ref={conversaRef} className="scroll-mt-4 rounded-lg border p-4">
            {selected ? (
              <>
                <h2 className="mb-3 text-sm font-semibold">{current?.prospects?.nome_empresa}</h2>
                {loadingThread ? <p className="text-xs text-muted-foreground">Carregando…</p> : <ConversationThread interacoes={interacoes} />}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Selecione uma resposta para ver a conversa completa, em todos os canais.</p>
            )}
          </div>
        </div>
      )}
    </PageShell>
  )
}
