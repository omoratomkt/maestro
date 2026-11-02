import { Power } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AgentDetail } from '@/components/agents/AgentDetail'
import { EmptyState, PageShell } from '@/components/layout/PageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePapeis, usePausaGeral, useUsoPorPapel, type PapelInfo } from '@/hooks/useAgentes'
import { usd } from '@/lib/agentes'
import { useAuth } from '@/lib/auth'

function InterruptorGeral() {
  const { pausada, alterar } = usePausaGeral(true)
  const [trabalhando, setTrabalhando] = useState(false)
  if (pausada === null) return null

  async function trocar() {
    const novo = !pausada
    const pergunta = novo
      ? 'Pausar TODA a IA do Maestro? Nenhuma mensagem nova será proposta e o envio automático para. O painel e o envio que você aprovar continuam.'
      : 'Religar a IA?'
    if (!window.confirm(pergunta)) return
    setTrabalhando(true)
    try {
      await alterar(novo)
      toast.success(novo ? 'IA pausada.' : 'IA religada.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao alterar')
    } finally {
      setTrabalhando(false)
    }
  }

  return (
    <Card className={pausada ? 'border-destructive' : undefined}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <p className="text-sm font-semibold">{pausada ? 'A IA está pausada' : 'A IA está ligada'}</p>
          <p className="text-xs text-muted-foreground">
            {pausada
              ? 'Nada novo é proposto e o envio automático está parado. Respostas de quem pediu para sair continuam sendo tratadas.'
              : 'Interruptor geral: pausa toda a IA de uma vez, para qualquer cliente, se algo sair errado.'}
          </p>
        </div>
        <Button variant={pausada ? 'default' : 'destructive'} size="sm" disabled={trabalhando} onClick={trocar}>
          <Power /> {pausada ? 'Religar a IA' : 'Pausar toda a IA'}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function Agents() {
  const { isSuperAdmin } = useAuth()
  const { papeis, loading, error } = usePapeis()
  const { porPapel, loading: carregandoUso, dias } = useUsoPorPapel()
  const [aberto, setAberto] = useState<PapelInfo | null>(null)

  return (
    <PageShell title="Agentes" description="Os papéis de IA do Maestro: o que cada um faz, o que recebeu, o que respondeu e quanto custou">
      <div className="space-y-6">
        {isSuperAdmin ? <InterruptorGeral /> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <Skeleton className="h-48" />
        ) : papeis.length === 0 && !error ? (
          <EmptyState message="Nenhum agente encontrado." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {papeis.map((p) => {
              const u = porPapel[p.papel]
              return (
                <Card key={p.papel}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="leading-snug">{p.nome}</CardTitle>
                      <Badge variant={p.editavel ? 'default' : 'secondary'}>{p.editavel ? 'Editável' : 'Só leitura'}</Badge>
                    </div>
                    <p className="dados text-xs text-muted-foreground">{p.modelo}</p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <p className="text-muted-foreground">{p.funcao}</p>
                    <dl className="grid grid-cols-4 gap-2">
                      <div>
                        <dt className="text-muted-foreground">Chamadas</dt>
                        <dd className="font-medium">{carregandoUso ? '...' : (u?.chamadas ?? 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Falhas</dt>
                        <dd className="font-medium">{carregandoUso ? '...' : (u?.falhas ?? 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Custo</dt>
                        <dd className="font-medium">{carregandoUso ? '...' : usd(u?.custo ?? 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Tempo</dt>
                        <dd className="font-medium">{u?.tempoMedioMs != null ? `${(u.tempoMedioMs / 1000).toFixed(1)} s` : '-'}</dd>
                      </div>
                    </dl>
                    <p className="text-muted-foreground">Últimos {dias} dias.</p>
                    <Button variant="outline" size="sm" onClick={() => setAberto(p)}>
                      Ver detalhes
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
      {aberto ? <AgentDetail papel={aberto} podeEditar={isSuperAdmin} onClose={() => setAberto(null)} /> : null}
    </PageShell>
  )
}
