import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type InboxMessage = Tables<'prospect_interacoes'> & {
  prospects: Pick<Tables<'prospects'>, 'nome_empresa' | 'nome_contato' | 'cargo'> | null
  /** true quando já existe uma resposta do agente pendente de aprovação ou aprovada para este prospect. */
  agenteResponde: boolean
}

const LIMIT = 200

/** Respostas recebidas (direcao = 'in') em todos os canais, da mais recente para a mais antiga. */
export function useInbox() {
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      supabase
        .from('prospect_interacoes')
        .select('*, prospects(nome_empresa, nome_contato, cargo)')
        .eq('direcao', 'in')
        .order('enviado_em', { ascending: false })
        .limit(LIMIT),
      supabase.from('fila_acoes').select('prospect_id').eq('tipo', 'resposta').in('status', ['pendente', 'aprovada']),
    ]).then(([msgs, fila]) => {
      if (!active) return
      const err = msgs.error ?? fila.error
      if (err) return setError(err.message)
      const handled = new Set((fila.data ?? []).map((f) => f.prospect_id))
      setMessages(
        (msgs.data ?? []).map((m) => ({ ...m, prospects: m.prospects, agenteResponde: handled.has(m.prospect_id) })),
      )
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  return { messages, loading, error, truncated: messages.length >= LIMIT }
}
