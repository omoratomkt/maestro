import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, Pencil, Wand2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { FilaAcao } from '@/hooks/useQueue'
import { ActionProposal } from './ActionProposal'

interface Props {
  item: FilaAcao
  onApprove: (item: FilaAcao, edited?: string) => Promise<void>
  onReject: (item: FilaAcao) => Promise<void>
  onAutomate: (item: FilaAcao, nome: string, template: string) => Promise<void>
}

export function QueueItem({ item, onApprove, onReject, onAutomate }: Props) {
  const [editing, setEditing] = useState(false)
  const [automating, setAutomating] = useState(false)
  const [message, setMessage] = useState(item.mensagem)
  const [flowName, setFlowName] = useState(`${item.tipo} via ${item.canal}`)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true)
    try {
      await action()
      toast.success(ok)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao processar a ação')
      setBusy(false)
    }
  }

  const p = item.prospects
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{p?.nome_empresa ?? 'Prospect removido'}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {[p?.nome_contato, p?.cargo].filter(Boolean).join(' · ')}
              {item.campanhas?.nome ? ` — ${item.campanhas.nome}` : ''}
            </p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(item.criado_em), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ActionProposal item={item} editing={editing} message={message} onMessage={setMessage} />

        {automating ? (
          <div className="space-y-2 rounded-lg border p-3 text-xs">
            <p>
              Esta ação será aprovada agora e o padrão (<b>{item.tipo}</b> pelo canal <b>{item.canal}</b>, com a mensagem acima como
              template) passa a executar sem supervisão.
            </p>
            <Input value={flowName} onChange={(e) => setFlowName(e.target.value)} placeholder="Nome do fluxo automático" />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy || !flowName.trim()}
                onClick={() => run(() => onAutomate(item, flowName.trim(), message), 'Fluxo automático criado e ação aprovada.')}
              >
                Confirmar automação
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAutomating(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(() => onApprove(item, editing ? message : undefined), 'Ação aprovada.')}>
              <Check /> {editing ? 'Salvar e aprovar' : 'Aprovar'}
            </Button>
            {!editing ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
                <Pencil /> Editar e aprovar
              </Button>
            ) : null}
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => onReject(item), 'Ação rejeitada.')}>
              <X /> Rejeitar
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAutomating(true)}>
              <Wand2 /> Automatizar este padrão
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
