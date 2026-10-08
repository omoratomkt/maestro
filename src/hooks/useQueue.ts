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

export type FilaAcao = Tables<'fila_acoes'> & {
  prospects: Pick<Tables<'prospects'>, 'nome_empresa' | 'nome_contato' | 'cargo' | 'score'> | null
  campanhas: Pick<Tables<'campanhas'>, 'nome'> | null
}

/** Ações pendentes de aprovação + operações da fila. */
export function useQueue() {
  const { session, workspaceId } = useAuth()
  const [items, setItems] = useState<FilaAcao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('fila_acoes')
      .select('*, prospects(nome_empresa, nome_contato, cargo, score), campanhas(nome)')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: true })
    if (err) setError(err.message)
    else {
      setError(null)
      setItems(data as FilaAcao[])
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

  /** Aprova (com a mensagem editada, se houver). A execução é feita pela Edge Function action-execute. */
  const approve = (item: FilaAcao, editedMessage?: string) =>
    resolve(item.id, {
      status: 'aprovada',
      aprovada_por: session?.user.id ?? null,
      aprovada_em: new Date().toISOString(),
      mensagem_editada: editedMessage && editedMessage !== item.mensagem ? editedMessage : null,
    })

  const reject = (item: FilaAcao) =>
    resolve(item.id, { status: 'rejeitada', aprovada_por: session?.user.id ?? null, aprovada_em: new Date().toISOString() })

  /** Promove o padrão desta ação a fluxo automático e aprova a ação atual. */
  const automate = async (item: FilaAcao, nome: string, template: string) => {
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
    await approve(item, template)
  }

  return { items, loading, error, approve, reject, automate }
}
