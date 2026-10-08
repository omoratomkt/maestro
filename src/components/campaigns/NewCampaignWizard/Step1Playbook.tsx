import { Sparkles } from 'lucide-react'
import { usePlaybooks } from '@/hooks/useCampaigns'
import { cn } from '@/lib/utils'
import { draftFromPlaybook, emptyDraft, type CampaignDraft } from './types'

interface Props {
  draft: CampaignDraft
  onChange: (d: CampaignDraft) => void
}

export function Step1Playbook({ draft, onChange }: Props) {
  const { playbooks, loading } = usePlaybooks()

  const card = (selected: boolean) =>
    cn('w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted', selected && 'border-primary bg-muted')

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Playbooks pré-preenchem fontes, canais, ICP e persona. Você ajusta tudo nos próximos passos.
      </p>
      <button type="button" className={card(draft.playbook_id === null)} onClick={() => onChange({ ...emptyDraft, nome: draft.nome })}>
        <p className="text-sm font-medium">Campanha personalizada</p>
        <p className="text-xs text-muted-foreground">Começar do zero, sem playbook.</p>
      </button>
      {loading ? <p className="text-xs text-muted-foreground">Carregando playbooks…</p> : null}
      {playbooks.map((p) => (
        <button key={p.id} type="button" className={card(draft.playbook_id === p.id)} onClick={() => onChange(draftFromPlaybook(p))}>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-3.5" /> {p.nome}
          </p>
          {p.descricao ? <p className="text-xs text-muted-foreground">{p.descricao}</p> : null}
        </button>
      ))}
      {!loading && playbooks.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum playbook cadastrado ainda.</p>
      ) : null}
    </div>
  )
}
