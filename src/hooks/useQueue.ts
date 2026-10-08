import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

const QUEUE_EVENT = 'maestro:queue-changed'
const notifyQueueChanged = () => window.dispatchEvent(new Event(QUEUE_EVENT))

/** Quantidade de ações pendentes na fila de supervisão (badge da sidebar). */
export function usePendingQueueCount() {
  const [count, setCount] = useState<number | null>(null)

  const load = useCallback(() => {
    supabase
      .from('fila_acoes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .then(({ count: c, error }) => {
        if (!error) setCount(c ?? 0)
      })
  }, [])

  useEffect(() => {
    load()
    window.addEventListener(QUEUE_EVENT, load)
    window.addEventListener('focus', load)
    return () => {
      window.removeEventListener(QUEUE_EVENT, load)
      window.removeEventListener('focus', load)
    }
  }, [load])

  return count
}

type Prospect = { prospects: Pick<Tables<'prospects'>, 'nome_empresa' | 'nome_contato' | 'cargo' | 'score'> | null; campanhas: Pick<Tables<'campanhas'>, 'nome'> | null }
export type FilaAcao = Tables<'fila_acoes'> & Prospect

export interface SendResult {
  enviado: boolean
  detalhe: string
}

/** Pede à Edge Function action-execute para enviar uma ação já aprovada. */
async function executeOnServer(filaId: string): Promise<SendResult> {
  const { data, error } = await supabase.functions.invoke('action-execute', { body: { fila_id: filaId } })
  if (!error) return { enviado: Boolean(data?.ok), detalhe: data?.detalhe ?? '' }
  // 422 (envio falhou) devolve o motivo no corpo; outros erros caem na mensagem genérica.
  const ctx = (error as { context?: Response }).context
  const body = ctx ? await ctx.json().catch(() => null) : null
  return { enviado: false, detalhe: body?.detalhe ?? body?.error ?? error.message }
}

const SELECT = '*, prospects(nome_empresa, nome_contato, cargo, score), campanhas(nome)'

/** Ações pendentes de aprovação, ações aprovadas com falha de envio e as operações da fila. */
export function useQueue() {
  const { session, workspaceId } = useAuth()
  const [items, setItems] = useState<FilaAcao[]>([])
  const [falhas, setFalhas] = useState<FilaAcao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [pend, fail] = await Promise.all([
      supabase.from('fila_acoes').select(SELECT).eq('status', 'pendente').order('criado_em', { ascending: true }),
      supabase.from('fila_acoes').select(SELECT).eq('status', 'aprovada').not('erro_execucao', 'is', null).order('criado_em', { ascending: true }),
    ])
    const err = pend.error ?? fail.error
    if (err) setError(err.message)
    else {
      setError(null)
      setItems((pend.data ?? []) as FilaAcao[])
      setFalhas((fail.data ?? []) as FilaAcao[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const resolve = async (id: string, patch: Partial<Tables<'fila_acoes'>>) => {
    const { error: err } = await supabase.from('fila_acoes').update(patch).eq('id', id).eq('status', 'pendente')
    if (err) throw new Error(err.message)
    setItems((list) => list.filter((i) => i.id !== id))
    notifyQueueChanged()
  }

  /** Aprova (com a mensagem editada, se houver) e já envia pelo canal. Se o envio falhar, a ação fica em "falhas". */
  const approve = async (item: FilaAcao, editedMessage?: string): Promise<SendResult> => {
    await resolve(item.id, {
      status: 'aprovada',
      aprovada_por: session?.user.id ?? null,
      aprovada_em: new Date().toISOString(),
      mensagem_editada: editedMessage && editedMessage !== item.mensagem ? editedMessage : null,
    })
    const result = await executeOnServer(item.id)
    if (!result.enviado) await reload()
    return result
  }

  const retry = async (item: FilaAcao): Promise<SendResult> => {
    const result = await executeOnServer(item.id)
    await reload()
    return result
  }

  const reject = (item: FilaAcao) =>
    resolve(item.id, { status: 'rejeitada', aprovada_por: session?.user.id ?? null, aprovada_em: new Date().toISOString() })

  const cancel = async (item: FilaAcao) => {
    const { error: err } = await supabase.from('fila_acoes').update({ status: 'cancelada' }).eq('id', item.id).eq('status', 'aprovada')
    if (err) throw new Error(err.message)
    setFalhas((list) => list.filter((i) => i.id !== item.id))
  }

  /** Promove o padrão desta ação a fluxo automático e aprova (e envia) a ação atual. */
  const automate = async (item: FilaAcao, nome: string, template: string): Promise<SendResult> => {
    if (!workspaceId) throw new Error('Usuário sem workspace vinculado.')
    const { error: err } = await supabase.from('fluxos_automaticos').insert({
      workspace_id: item.workspace_id,
      campanha_id: item.campanha_id,
      nome,
      descricao: `Promovido da fila de supervisão. Motivo original: ${item.razao}`,
      condicao: { evento: `acao_${item.tipo}`, canal: item.canal, delay_horas: 0 },
      tipo_acao: item.tipo,
      canal_acao: item.canal,
      template_mensagem: template,
    })
    if (err) throw new Error(err.message)
    return approve(item, template)
  }

  return { items, falhas, loading, error, approve, reject, automate, retry, cancel }
}
