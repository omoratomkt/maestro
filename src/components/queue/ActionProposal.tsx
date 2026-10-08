import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import type { FilaAcao } from '@/hooks/useQueue'
import { canalLabel } from '@/lib/constants'

const TIPOS: Record<string, string> = {
  primeira_mensagem: 'Primeira mensagem',
  followup: 'Follow-up',
  resposta: 'Resposta',
  reengajamento: 'Reengajamento',
  encerrar: 'Encerrar',
}

interface Props {
  item: FilaAcao
  editing: boolean
  message: string
  onMessage: (m: string) => void
}

/** O que o agente propõe: ação, canal, mensagem e a razão da decisão. */
export function ActionProposal({ item, editing, message, onMessage }: Props) {
  // Canais da fila usam o vocabulário de campanhas ('email', 'whatsapp_evolution'...) ou de interações ('whatsapp').
  const canal = canalLabel(item.canal)
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-1.5">
        <Badge>{TIPOS[item.tipo] ?? item.tipo}</Badge>
        <Badge variant="outline">{canal}</Badge>
      </div>
      {editing ? (
        <Textarea rows={5} value={message} onChange={(e) => onMessage(e.target.value)} />
      ) : (
        <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2">{item.mensagem}</p>
      )}
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">Por que o agente quer fazer isso: </span>
        {item.razao}
      </p>
    </div>
  )
}
