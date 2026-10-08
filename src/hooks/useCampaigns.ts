import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'

export type CampanhaStatus = 'rascunho' | 'ativa' | 'pausada' | 'encerrada'
export type Campanha = Omit<Tables<'campanhas'>, 'status'> & { status: CampanhaStatus }
export type Playbook = Tables<'playbooks'>

export function useCampaigns() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('campanhas')
      .select('*')
      .order('criado_em', { ascending: false })
    if (err) setError(err.message)
    else {
      setError(null)
      setCampanhas(data as Campanha[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const create = async (input: TablesInsert<'campanhas'>) => {
    const { error: err } = await supabase.from('campanhas').insert(input)
    if (err) throw new Error(err.message)
    await reload()
  }

  const update = async (id: string, patch: TablesUpdate<'campanhas'>) => {
    const { error: err } = await supabase.from('campanhas').update(patch).eq('id', id)
    if (err) throw new Error(err.message)
    await reload()
  }

  const setStatus = async (id: string, status: Campanha['status']) => {
    const { error: err } = await supabase
      .from('campanhas')
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq('id', id)
    if (err) throw new Error(err.message)
    await reload()
  }

  return { campanhas, loading, error, create, update, setStatus }
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
