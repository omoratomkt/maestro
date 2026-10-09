import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { callFunction } from '@/lib/functions'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'

export type CampanhaStatus = 'rascunho' | 'ativa' | 'pausada' | 'encerrada'
export type Campanha = Omit<Tables<'campanhas'>, 'status'> & { status: CampanhaStatus }
export type Playbook = Tables<'playbooks'>

interface SearchReport {
  inseridos: number
  quota: number
  fontes: Record<string, string>
}

export function formatSearchReport(r: SearchReport): string {
  const detalhes = Object.entries(r.fontes).map(([f, s]) => `${f}: ${s}`).join(' · ')
  return `${r.inseridos} novo(s) prospect(s) (cota semanal restante: ${r.quota}). ${detalhes}`
}

export function useCampaigns() {
  const { workspaceId } = useAuth()
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!workspaceId) return
    const { data, error: err } = await supabase
      .from('campanhas')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('criado_em', { ascending: false })
    if (err) setError(err.message)
    else {
      setError(null)
      setCampanhas(data as Campanha[])
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  /** Dispara a busca de prospects nas fontes da campanha (Edge Function source-search). */
  const buscar = async (id: string): Promise<string> => {
    const r = await callFunction<SearchReport>('source-search', { campanha_id: id })
    if (!r.ok) throw new Error(r.error ?? 'Falha na busca')
    return formatSearchReport(r.data!)
  }

  /** Cria a campanha; se já nasce ativa, inicia a busca. Retorna o resumo da busca (ou null). */
  const create = async (input: TablesInsert<'campanhas'>): Promise<string | null> => {
    const { data, error: err } = await supabase.from('campanhas').insert(input).select('id').single()
    if (err) throw new Error(err.message)
    await reload()
    return input.status === 'ativa' ? buscar(data.id).catch((e) => `Campanha criada, mas a busca falhou: ${e.message}`) : null
  }

  /** Exclui só campanhas sem prospects (o histórico não é apagado por engano). */
  const remove = async (id: string) => {
    const { count } = await supabase.from('prospects').select('id', { count: 'exact', head: true }).eq('campanha_id', id)
    if (count) throw new Error(`Esta campanha tem ${count} prospect(s). Use "Encerrar" para preservar o histórico.`)
    const { error: err } = await supabase.from('campanhas').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await reload()
  }

  const update = async (id: string, patch: TablesUpdate<'campanhas'>) => {
    const { error: err } = await supabase.from('campanhas').update(patch).eq('id', id)
    if (err) throw new Error(err.message)
    await reload()
  }

  const setStatus = async (id: string, status: Campanha['status']): Promise<string | null> => {
    const { error: err } = await supabase
      .from('campanhas')
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq('id', id)
    if (err) throw new Error(err.message)
    await reload()
    const demo = campanhas.find((c) => c.id === id)?.nome.startsWith('[DEMO]')
    return status === 'ativa' && !demo ? buscar(id).catch((e) => `Campanha ativa, mas a busca falhou: ${e.message}`) : null
  }

  return { campanhas, loading, error, create, update, setStatus, remove, buscar }
}

export function usePlaybooks() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('playbooks')
      .select('*')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => {
        if (!active) return
        setPlaybooks(data ?? [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { playbooks, loading }
}
