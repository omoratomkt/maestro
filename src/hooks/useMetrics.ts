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

export interface CampaignMetrics {
  campanha_id: string
  nome: string
  status: string
  prospects_total: number
  contatados: number
  responderam: number
  qualificados: number
  custo_usd: number
}

export interface HistoryPoint {
  dia: string
  respostas: number
  qualificados: number
  mensagens_enviadas: number
}

/** Agregados do período (função SQL metricas_resumo, com RLS do usuário), opcionalmente de uma campanha só. */
export function useMetrics(dias: number, campanhaId: string | null = null) {
  const { workspaceId } = useAuth()
  const [data, setData] = useState<MetricsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null)
    supabase
      .rpc('metricas_resumo', { dias, p_ws: workspaceId ?? undefined, p_camp: campanhaId ?? undefined })
      .then(({ data: d, error: err }) => {
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
  }, [dias, workspaceId, campanhaId])

  return { data, error }
}

/** Uma linha por campanha, para comparar o desempenho entre elas. */
export function useCampaignComparison(dias: number) {
  const { workspaceId } = useAuth()
  const [rows, setRows] = useState<CampaignMetrics[] | null>(null)

  useEffect(() => {
    let active = true
    supabase.rpc('metricas_por_campanha', { dias, p_ws: workspaceId ?? undefined }).then(({ data }) => {
      if (active) setRows((data ?? []) as unknown as CampaignMetrics[])
    })
    return () => {
      active = false
    }
  }, [dias, workspaceId])

  return rows
}

/** Evolução diária (acumulada) a partir das fotos de campanha_metricas, somando as campanhas ou só uma. */
export function useHistory(dias: number, campanhaId: string | null) {
  const { workspaceId } = useAuth()
  const [points, setPoints] = useState<HistoryPoint[] | null>(null)

  useEffect(() => {
    if (!workspaceId) return
    let active = true
    const desde = new Date(Date.now() - dias * 24 * 3600e3).toISOString().slice(0, 10)
    let q = supabase
      .from('campanha_metricas')
      .select('dia, respostas, qualificados, mensagens_enviadas, campanha_id')
      .eq('workspace_id', workspaceId)
      .gte('dia', desde)
      .order('dia')
    if (campanhaId) q = q.eq('campanha_id', campanhaId)
    q.then(({ data }) => {
      if (!active) return
      const porDia = new Map<string, HistoryPoint>()
      for (const r of data ?? []) {
        const p = porDia.get(r.dia) ?? { dia: r.dia, respostas: 0, qualificados: 0, mensagens_enviadas: 0 }
        p.respostas += r.respostas
        p.qualificados += r.qualificados
        p.mensagens_enviadas += r.mensagens_enviadas
        porDia.set(r.dia, p)
      }
      setPoints([...porDia.values()])
    })
    return () => {
      active = false
    }
  }, [dias, workspaceId, campanhaId])

  return points
}
