import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type Fluxo = Tables<'fluxos_automaticos'>
export type ExecucaoRecente = Tables<'fila_acoes'> & { prospects: Pick<Tables<'prospects'>, 'nome_empresa'> | null }

export function useAutomations() {
  const { workspaceId } = useAuth()
  const [fluxos, setFluxos] = useState<Fluxo[]>([])
  const [log, setLog] = useState<ExecucaoRecente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!workspaceId) return
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const [f, l] = await Promise.all([
      supabase.from('fluxos_automaticos').select('*').eq('workspace_id', workspaceId).order('criado_em', { ascending: false }),
      supabase
        .from('fila_acoes')
        .select('*, prospects!fila_acoes_prospect_id_fkey(nome_empresa)')
        .eq('workspace_id', workspaceId)
        .not('fluxo_automatico_id', 'is', null)
        .gte('criado_em', since)
        .order('criado_em', { ascending: false })
        .limit(100),
    ])
    const err = f.error ?? l.error
    if (err) setError(err.message)
    else {
      setError(null)
      setFluxos(f.data ?? [])
      setLog((l.data ?? []) as ExecucaoRecente[])
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const setAtivo = async (id: string, ativo: boolean) => {
    const { error: err } = await supabase
      .from('fluxos_automaticos')
      .update({ ativo, atualizado_em: new Date().toISOString() })
      .eq('id', id)
    if (err) throw new Error(err.message)
    setFluxos((list) => list.map((x) => (x.id === id ? { ...x, ativo } : x)))
  }

  return { fluxos, log, loading, error, setAtivo }
}
