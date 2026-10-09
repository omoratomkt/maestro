import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type Alerta = Tables<'prospect_alerts'> & { prospects: Pick<Tables<'prospects'>, 'nome_empresa' | 'nome_contato'> | null }

export const TIPOS_ALERTA: Record<string, string> = {
  inauguracao_recente: 'Inauguração recente',
  avaliacoes_negativas: 'Avaliações negativas no Google',
  site_fora_do_ar: 'Site fora do ar',
}

export function descreverAlerta(a: Pick<Alerta, 'tipo' | 'detalhe'>): string {
  const d = (a.detalhe ?? {}) as Record<string, number | string>
  if (a.tipo === 'inauguracao_recente') return `Empresa aberta há ${d.meses ?? '?'} mês(es): bom momento para se apresentar.`
  if (a.tipo === 'avaliacoes_negativas') return `Nota ${d.nota} em ${d.avaliacoes} avaliações: pode haver dor com atendimento ou reputação.`
  if (a.tipo === 'site_fora_do_ar') return `O site respondeu ${d.status ?? 'com erro'}.`
  return ''
}

/** Sinais de timing detectados no enriquecimento e ainda não vistos. */
export function useAlertas() {
  const { workspaceId } = useAuth()
  const [alertas, setAlertas] = useState<Alerta[]>([])

  const load = useCallback(async () => {
    if (!workspaceId) return
    const { data } = await supabase
      .from('prospect_alerts')
      .select('*, prospects(nome_empresa, nome_contato)')
      .eq('workspace_id', workspaceId)
      .eq('lido', false)
      .order('criado_em', { ascending: false })
      .limit(20)
    setAlertas((data ?? []) as unknown as Alerta[])
  }, [workspaceId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const marcarVisto = async (id: string) => {
    setAlertas((l) => l.filter((a) => a.id !== id))
    await supabase.from('prospect_alerts').update({ lido: true }).eq('id', id)
  }

  const marcarTodos = async () => {
    const ids = alertas.map((a) => a.id)
    setAlertas([])
    if (ids.length) await supabase.from('prospect_alerts').update({ lido: true }).in('id', ids)
  }

  return { alertas, marcarVisto, marcarTodos }
}
