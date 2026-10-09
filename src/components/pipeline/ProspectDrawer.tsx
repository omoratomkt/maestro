import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { EnrichmentPanel } from '@/components/pipeline/EnrichmentPanel'
import { ProspectActions } from '@/components/pipeline/ProspectActions'
import { ConversationThread } from '@/components/inbox/ConversationThread'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useProspectDetail, type Prospect } from '@/hooks/useProspects'
import { ALL_PROSPECT_STATUS } from '@/lib/constants'

interface Props {
  prospect: Prospect | null
  onClose: () => void
  onStatus: (id: string, status: string) => Promise<void>
  /** Chamado depois de excluir o prospect (fecha o painel e recarrega a lista). */
  onDeleted: () => void
  /** Chamado quando os dados do prospect mudam por fora do arrastar-e-soltar (ex.: reenriquecer). */
  onChanged: () => void
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

export function ProspectDrawer({ prospect: p, onClose, onStatus, onDeleted, onChanged }: Props) {
  const { interacoes, estado, lead, setStatusReuniao, loading } = useProspectDetail(p?.id ?? null)
  const b = (lead?.briefing ?? {}) as Record<string, unknown>
  const lista = (v: unknown) => (Array.isArray(v) ? v.map(String).join(' · ') : null)
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

              {lead ? (
                <section className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Lead qualificado</h3>
                    {lead.score_temperatura !== null ? <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{lead.score_temperatura}/10</span> : null}
                  </div>
                  <dl className="grid grid-cols-2 gap-2">
                    <Info label="Dor principal" value={b.dor_principal as string} />
                    <Info label="Orçamento" value={b.budget as string} />
                    <Info label="Prazo" value={b.timeline as string} />
                    <Info label="Decisor" value={b.e_decisor === undefined ? null : b.e_decisor ? 'Sim' : 'Não'} />
                    <Info label="Sentimento" value={b.sentimento as string} />
                    <Info label="Objeções" value={lista(b.objecoes)} />
                  </dl>
                  {b.resumo_conversa ? <p className="text-muted-foreground">{String(b.resumo_conversa)}</p> : null}
                  {lead.proximo_passo ? <p><span className="font-medium">Próximo passo:</span> {lead.proximo_passo}</p> : null}
                  <div className="flex items-center gap-2">
                    <label className="font-medium">Reunião</label>
                    <select
                      className="h-8 flex-1 rounded-lg border bg-background px-2 text-sm"
                      value={lead.status_reuniao ?? 'pendente'}
                      onChange={(e) => setStatusReuniao(e.target.value).catch((err) => toast.error(err.message))}
                    >
                      {['pendente', 'agendada', 'realizada', 'no_show', 'cancelada'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  {lead.reuniao_em ? <p className="text-muted-foreground">Marcada para {fmt(lead.reuniao_em)}</p> : null}
                </section>
              ) : null}

              <EnrichmentPanel prospect={p} onChanged={onChanged} />

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

              <ProspectActions prospect={p} onDeleted={onDeleted} />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
