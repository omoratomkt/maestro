import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/types/database'

export type Prospect = Tables<'prospects'>
export type Interacao = Tables<'prospect_interacoes'>
export type ProspectEstado = Tables<'prospect_estado'>

const LIMIT = 1000

export function useProspects() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('prospects')
      .select('*')
      .order('score', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false })
      .limit(LIMIT)
    if (err) setError(err.message)
    else {
      setError(null)
      setProspects(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  /** Move o prospect de status (otimista; reverte se o banco recusar). */
  const setStatus = async (id: string, status: string) => {
    const previous = prospects
    setProspects((list) => list.map((p) => (p.id === id ? { ...p, status } : p)))
    const { error: err } = await supabase
      .from('prospects')
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq('id', id)
    if (err) {
      setProspects(previous)
      throw new Error(err.message)
    }
  }

  const importMany = async (rows: TablesInsert<'prospects'>[]) => {
    for (let i = 0; i < rows.length; i += 200) {
      const { error: err } = await supabase.from('prospects').insert(rows.slice(i, i + 200))
      if (err) throw new Error(err.message)
    }
    await reload()
  }

  return { prospects, loading, error, truncated: prospects.length >= LIMIT, setStatus, importMany, reload }
}

/** Histórico cross-canal e estado do agente de um prospect. */
export function useProspectDetail(prospectId: string | null) {
  const [interacoes, setInteracoes] = useState<Interacao[]>([])
  const [estado, setEstado] = useState<ProspectEstado | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!prospectId) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([
      supabase.from('prospect_interacoes').select('*').eq('prospect_id', prospectId).order('enviado_em'),
      supabase.from('prospect_estado').select('*').eq('prospect_id', prospectId).maybeSingle(),
    ]).then(([i, e]) => {
      if (!active) return
      setInteracoes(i.data ?? [])
      setEstado(e.data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [prospectId])

  return { interacoes, estado, loading }
}
