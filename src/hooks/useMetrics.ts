import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export interface MetricsSummary {
  prospects_processados: number
  mensagens_enviadas: number
  respostas: number
  qualificados: number
  horas_ate_qualificar: number | null
  custo_total_usd: number
  custo_por_lead_usd: number | null
  por_canal: { canal: string; contatados: number; responderam: number }[]
  funil: { status: string; total: number }[]
}

/** Agregados do período (função SQL metricas_resumo, com RLS do usuário). */
export function useMetrics(dias: number) {
  const { workspaceId } = useAuth()
  const [data, setData] = useState<MetricsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null)
    supabase.rpc('metricas_resumo', { dias, p_ws: workspaceId ?? undefined }).then(({ data: d, error: err }) => {
      if (!active) return
      if (err) setError(err.message)
      else {
        setError(null)
        setData(d as unknown as MetricsSummary)
      }
    })
    return () => {
      active = false
    }
  }, [dias, workspaceId])

  return { data, error }
}
