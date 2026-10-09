import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useTableChanges } from '@/lib/realtime'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

/** respondida: já há mensagem nossa depois · agente: resposta proposta na fila · humano: ninguém respondeu e nada está proposto */
export type InboxState = 'respondida' | 'agente' | 'humano'

export type InboxMessage = Tables<'prospect_interacoes'> & {
  prospects: Pick<Tables<'prospects'>, 'nome_empresa' | 'nome_contato' | 'cargo'> | null
  estado: InboxState
}

const LIMIT = 600

/** Respostas recebidas (direcao = 'in') em todos os canais, da mais recente para a mais antiga. */
export function useInbox() {
  const { workspaceId } = useAuth()
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useTableChanges(['prospect_interacoes', 'fila_acoes'], () => setTick((t) => t + 1))

  useEffect(() => {
    let active = true
    Promise.all([
      // Busca as duas direções para saber se uma resposta já foi respondida depois.
      supabase
        .from('prospect_interacoes')
        .select('*, prospects!inner(nome_empresa, nome_contato, cargo, workspace_id)')
        .eq('prospects.workspace_id', workspaceId ?? '')
        .order('enviado_em', { ascending: false })
        .limit(LIMIT),
      supabase.from('fila_acoes').select('prospect_id').eq('workspace_id', workspaceId ?? '').eq('tipo', 'resposta').in('status', ['pendente', 'aprovada']),
    ]).then(([all, fila]) => {
      if (!active) return
      const err = all.error ?? fila.error
      if (err) return setError(err.message)
      const rows = all.data ?? []
      const proposed = new Set((fila.data ?? []).map((f) => f.prospect_id))
      const lastOut = new Map<string, string>()
      for (const r of rows) {
        if (r.direcao === 'out' && !lastOut.has(r.prospect_id)) lastOut.set(r.prospect_id, r.enviado_em) // linhas já vêm da mais recente
      }
      setMessages(
        rows
          .filter((r) => r.direcao === 'in')
          .map((m) => {
            const out = lastOut.get(m.prospect_id)
            const estado: InboxState = out && out > m.enviado_em ? 'respondida' : proposed.has(m.prospect_id) ? 'agente' : 'humano'
            return { ...m, estado }
          }),
      )
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [tick, workspaceId])

  return { messages, loading, error, truncated: messages.length >= LIMIT }
}
