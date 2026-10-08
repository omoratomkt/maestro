import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import type { InboxMessage } from '@/hooks/useInbox'
import { CANAIS_INTERACAO, labelOf } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface Props {
  messages: InboxMessage[]
  selectedProspectId: string | null
  onSelect: (m: InboxMessage) => void
}

export function InboxList({ messages, selectedProspectId, onSelect }: Props) {
  return (
    <ul className="divide-y rounded-lg border">
      {messages.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => onSelect(m)}
            className={cn('w-full space-y-1 px-3 py-2.5 text-left text-xs hover:bg-muted/50', m.prospect_id === selectedProspectId && 'bg-muted')}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{m.prospects?.nome_empresa ?? 'Prospect removido'}</span>
              <span className="shrink-0 text-muted-foreground">
                {formatDistanceToNow(new Date(m.enviado_em), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
            <p className="line-clamp-2 text-muted-foreground">{m.conteudo}</p>
            <div className="flex gap-1.5">
              <Badge variant="outline">{labelOf(CANAIS_INTERACAO, m.canal)}</Badge>
              <Badge variant={m.agenteResponde ? 'secondary' : 'default'}>{m.agenteResponde ? 'Agente vai responder' : 'Aguarda humano'}</Badge>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
