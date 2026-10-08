import { Pencil, Pause, Play, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Campanha } from '@/hooks/useCampaigns'
import { CANAIS, FONTES, STATUS_CAMPANHA, labelOf } from '@/lib/constants'

interface Props {
  campanha: Campanha
  onStatus: (id: string, status: Campanha['status']) => Promise<void>
  onEdit: (c: Campanha) => void
}

export function CampaignCard({ campanha: c, onStatus, onEdit }: Props) {
  async function change(status: Campanha['status']) {
    try {
      await onStatus(c.id, status)
      toast.success(`Campanha ${STATUS_CAMPANHA[status].toLowerCase()}.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar campanha')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="leading-snug">{c.nome}</CardTitle>
          <Badge variant={c.status === 'ativa' ? 'default' : 'secondary'}>{STATUS_CAMPANHA[c.status]}</Badge>
        </div>
        {c.segmento ? <p className="text-xs text-muted-foreground">{c.segmento}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <dl className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-muted-foreground">Score mínimo</dt>
            <dd className="font-medium">{c.score_minimo}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Volume semanal</dt>
            <dd className="font-medium">{c.volume_semanal ?? '—'}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-1">
          {(c.canais ?? []).map((v) => (
            <Badge key={v} variant="outline">
              {labelOf(CANAIS, v)}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {(c.fontes ?? []).map((v) => (
            <Badge key={v} variant="secondary">
              {labelOf(FONTES, v)}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => onEdit(c)}>
            <Pencil /> Editar
          </Button>
          {c.status === 'ativa' ? (
            <Button size="sm" variant="outline" onClick={() => change('pausada')}>
              <Pause /> Pausar
            </Button>
          ) : c.status !== 'encerrada' ? (
            <Button size="sm" variant="outline" onClick={() => change('ativa')}>
              <Play /> {c.status === 'rascunho' ? 'Lançar' : 'Reativar'}
            </Button>
          ) : null}
          {c.status !== 'encerrada' ? (
            <Button size="sm" variant="ghost" onClick={() => change('encerrada')}>
              <Square /> Encerrar
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
