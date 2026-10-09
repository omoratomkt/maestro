import { useEffect, useState } from 'react'
import { useTableChanges } from '@/lib/realtime'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type HotLead = Tables<'leads_qualificados'> & {
  prospects: Pick<Tables<'prospects'>, 'nome_empresa' | 'nome_contato' | 'cargo'> | null
}

interface DashboardData {
  pendentes: number
  novosHoje: number
  enviadasHoje: number
  respostasHoje: number
  qualificadosHoje: number
  leadsQuentes: HotLead[]
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useTableChanges(['fila_acoes', 'prospects', 'prospect_interacoes', 'leads_qualificados'], () => setTick((t) => t + 1))

  useEffect(() => {
    let active = true
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const since = start.toISOString()
    const count = (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => q

    Promise.all([
      count(supabase.from('fila_acoes').select('id', { count: 'exact', head: true }).eq('status', 'pendente')),
      count(supabase.from('prospects').select('id', { count: 'exact', head: true }).gte('criado_em', since)),
      count(supabase.from('prospect_interacoes').select('id', { count: 'exact', head: true }).eq('direcao', 'out').gte('enviado_em', since)),
      count(supabase.from('prospect_interacoes').select('id', { count: 'exact', head: true }).eq('direcao', 'in').gte('enviado_em', since)),
      count(supabase.from('leads_qualificados').select('id', { count: 'exact', head: true }).gte('qualificado_em', since)),
      supabase
        .from('leads_qualificados')
        .select('*, prospects(nome_empresa, nome_contato, cargo)')
        .in('status_reuniao', ['pendente', 'agendada'])
        .order('score_temperatura', { ascending: false, nullsFirst: false })
        .limit(5),
    ]).then(([pend, novos, env, resp, qual, quentes]) => {
      if (!active) return
      const failed = [pend, novos, env, resp, qual, quentes].find((r) => r.error)
      if (failed?.error) return setError(failed.error.message)
      setData({
        pendentes: pend.count ?? 0,
        novosHoje: novos.count ?? 0,
        enviadasHoje: env.count ?? 0,
        respostasHoje: resp.count ?? 0,
        qualificadosHoje: qual.count ?? 0,
        leadsQuentes: (quentes.data ?? []) as HotLead[],
      })
    })
    return () => {
      active = false
    }
  }, [tick])

  return { data, error }
}
