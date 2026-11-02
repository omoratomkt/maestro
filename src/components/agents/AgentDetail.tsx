import { format } from 'date-fns'
import { History } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { RESULTADO_ROTULO, usd } from '@/lib/agentes'
import { useChamadasRecentes, useInstrucoesDoAgente, type ChamadaIa, type PapelInfo } from '@/hooks/useAgentes'

const MAX_INSTRUCOES = 4000


function Chamada({ c }: { c: ChamadaIa }) {
  const [aberta, setAberta] = useState(false)
  return (
    <li className="rounded-lg border px-3 py-2 text-xs">
      <button type="button" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left" onClick={() => setAberta((v) => !v)}>
        <span className="dados">{format(new Date(c.criado_em), 'dd/MM HH:mm:ss')}</span>
        <Badge variant={c.resultado === 'ok' ? 'outline' : 'destructive'}>{RESULTADO_ROTULO[c.resultado] ?? c.resultado}</Badge>
        <span className="text-muted-foreground">
          {c.tokens_in ?? 0} entrada, {c.tokens_out ?? 0} saída
        </span>
        <span className="text-muted-foreground">{usd(Number(c.custo_usd ?? 0))}</span>
        <span className="text-muted-foreground">{c.tempo_ms != null ? `${(c.tempo_ms / 1000).toFixed(1)} s` : ''}</span>
      </button>
      {aberta ? (
        <div className="mt-2 space-y-2">
          {c.erro ? <p className="text-destructive">{c.erro}</p> : null}
          <p className="label">Recebeu</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2">{c.entrada ?? ''}</pre>
          {c.saida ? (
            <>
              <p className="label">Respondeu</p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2">{c.saida}</pre>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function InstrucoesDoAgente({ podeEditar }: { podeEditar: boolean }) {
  const { instrucoes, versoes, loading, salvar } = useInstrucoesDoAgente()
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [historico, setHistorico] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTexto(instrucoes)
  }, [instrucoes])

  if (loading) return <Skeleton className="h-24" />

  async function gravar() {
    setSalvando(true)
    try {
      await salvar(texto)
      toast.success('Instruções salvas. Valem a partir da próxima resposta do agente.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Instruções adicionais do agente</h3>
      <p className="text-xs text-muted-foreground">
        Complementam a persona de cada campanha. As regras de conduta abaixo ficam no código e valem sempre: nenhuma instrução aqui as substitui.
      </p>
      <Textarea
        rows={6}
        maxLength={MAX_INSTRUCOES}
        value={texto}
        disabled={!podeEditar}
        placeholder="Ex.: Quando perguntarem de onde somos, diga que atendemos clínicas e consultórios de São Paulo."
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {texto.length} de {MAX_INSTRUCOES}
          {podeEditar ? '' : '. Só o administrador edita.'}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setHistorico((v) => !v)}>
            <History /> {historico ? 'Esconder o histórico' : 'Ver o histórico'}
          </Button>
          {podeEditar ? (
            <Button size="sm" disabled={salvando || texto.trim() === instrucoes.trim()} onClick={gravar}>
              Salvar
            </Button>
          ) : null}
        </div>
      </div>
      {historico ? (
        <ul className="max-h-56 space-y-1.5 overflow-auto">
          {versoes.length === 0 ? <li className="text-xs text-muted-foreground">Nenhuma versão guardada ainda.</li> : null}
          {versoes.map((v, i) => (
            <li key={v.id} className="flex items-start gap-3 rounded-lg border px-3 py-2 text-xs">
              <div className="min-w-0 flex-1">
                <p>
                  <span className="dados">{format(new Date(v.criado_em), 'dd/MM/yyyy HH:mm')}</span>
                  {i === 0 ? <Badge className="ml-2" variant="outline">atual</Badge> : null}
                </p>
                <p className="mt-0.5 truncate text-muted-foreground">{v.instrucoes.replace(/\s+/g, ' ').slice(0, 140)}</p>
              </div>
              {podeEditar && v.instrucoes !== texto ? (
                <button type="button" className="shrink-0 text-primary underline-offset-2 hover:underline" onClick={() => setTexto(v.instrucoes)}>
                  Carregar no editor
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export function AgentDetail({ papel, podeEditar, onClose }: { papel: PapelInfo; podeEditar: boolean; onClose: () => void }) {
  const { chamadas, loading } = useChamadasRecentes(papel.papel)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{papel.nome}</DialogTitle>
          <DialogDescription>
            {papel.funcao} Modelo: <span className="dados">{papel.modelo}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {papel.editavel ? <InstrucoesDoAgente podeEditar={podeEditar} /> : null}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{papel.editavel ? 'Modelo do prompt e regras de conduta (no código)' : 'Prompt atual (no código)'}</h3>
            <p className="text-xs text-muted-foreground">
              {papel.editavel
                ? 'É o texto que o agente recebe. Os trechos entre < > são preenchidos com a persona de cada campanha.'
                : 'Este papel não é editável pelo painel. O texto abaixo é exatamente o que roda.'}
            </p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{papel.prompt}</pre>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Chamadas recentes</h3>
            {loading ? (
              <Skeleton className="h-16" />
            ) : chamadas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma chamada registrada ainda. Elas aparecem aqui assim que este papel for usado.</p>
            ) : (
              <ul className="space-y-1.5">
                {chamadas.map((c) => (
                  <Chamada key={c.id} c={c} />
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">O texto das chamadas é mascarado (senhas e chaves somem) e guardado por 90 dias.</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
