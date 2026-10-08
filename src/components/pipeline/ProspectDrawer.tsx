import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ConversationThread } from '@/components/inbox/ConversationThread'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useProspectDetail, type Prospect } from '@/hooks/useProspects'
import { ALL_PROSPECT_STATUS } from '@/lib/constants'

interface Props {
  prospect: Prospect | null
  onClose: () => void
  onStatus: (id: string, status: string) => Promise<void>
}

function Info({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  )
}

export function ProspectDrawer({ prospect: p, onClose, onStatus }: Props) {
  const { interacoes, estado, loading } = useProspectDetail(p?.id ?? null)
  const fmt = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }) : null)

  return (
    <Sheet open={Boolean(p)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        {p ? (
          <>
            <SheetHeader>
              <SheetTitle>{p.nome_empresa}</SheetTitle>
              <SheetDescription>{[p.nome_contato, p.cargo].filter(Boolean).join(' · ') || 'Sem contato definido'}</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-medium">Status</label>
                <select
                  className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm"
                  value={p.status}
                  onChange={(e) => onStatus(p.id, e.target.value)}
                >
                  {ALL_PROSPECT_STATUS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <Info label="Score" value={p.score} />
                <Info label="Fonte" value={p.fonte} />
                <Info label="WhatsApp" value={p.whatsapp} />
                <Info label="Email" value={p.email} />
                <Info label="LinkedIn" value={p.linkedin_url} />
                <Info label="Instagram" value={p.instagram_handle} />
                <Info label="Website" value={p.website} />
                <Info label="CNPJ" value={p.cnpj} />
                <Info label="Segmento" value={p.segmento} />
                <Info label="Local" value={[p.cidade, p.estado].filter(Boolean).join(' - ')} />
                <Info label="Primeiro contato" value={fmt(p.primeiro_contato_em)} />
                <Info label="Última interação" value={fmt(p.ultima_interacao_em)} />
              </dl>

              {estado ? (
                <section className="space-y-1 rounded-lg border p-3">
                  <h3 className="font-semibold">Estado do agente</h3>
                  <p>Aguardando: {estado.aguardando ?? '—'}</p>
                  <p>Próxima ação: {fmt(estado.proxima_acao_em) ?? '—'}</p>
                  {estado.contexto_resumo ? <p className="text-muted-foreground">{estado.contexto_resumo}</p> : null}
                </section>
              ) : null}

              <section className="space-y-2">
                <h3 className="font-semibold">Histórico cross-canal</h3>
                {loading ? <p className="text-muted-foreground">Carregando…</p> : <ConversationThread interacoes={interacoes} />}
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
