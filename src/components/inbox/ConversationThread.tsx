import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Interacao } from '@/hooks/useProspects'
import { CANAIS_INTERACAO, labelOf } from '@/lib/constants'
import { cn } from '@/lib/utils'

/** Conversa cross-canal em ordem cronológica (in = prospect, out = Maestro). */
export function ConversationThread({ interacoes }: { interacoes: Interacao[] }) {
  if (interacoes.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhuma interação registrada.</p>
  }
  return (
    <ol className="space-y-2">
      {interacoes.map((i) => (
        <li key={i.id} className={cn('flex flex-col', i.direcao === 'out' ? 'items-end' : 'items-start')}>
          <div
            className={cn(
              'max-w-[85%] rounded-lg px-3 py-2 text-xs whitespace-pre-wrap',
              i.direcao === 'out' ? 'bg-primary text-primary-foreground' : 'bg-muted',
            )}
          >
            {i.conteudo}
          </div>
          <span className="mt-0.5 text-[10px] text-muted-foreground">
            {labelOf(CANAIS_INTERACAO, i.canal)} · {format(new Date(i.enviado_em), "dd/MM HH:mm", { locale: ptBR })}
            {i.direcao === 'out' && i.status ? ` · ${i.status}` : ''}
          </span>
        </li>
      ))}
    </ol>
  )
}
