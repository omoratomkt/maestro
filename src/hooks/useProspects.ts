import { useCallback, useEffect, useState } from 'react'
import { useTableChanges } from '@/lib/realtime'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/types/database'

export type Prospect = Tables<'prospects'>
export type Interacao = Tables<'prospect_interacoes'>
export type ProspectEstado = Tables<'prospect_estado'>
export type Lead = Tables<'leads_qualificados'>

const PAGE = 1000

export function useProspects() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('prospects')
      .select('*')
      .order('score', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false })
      .limit(limit)
    if (err) setError(err.message)
    else {
      setError(null)
      setProspects(data)
    }
    setLoading(false)
  }, [limit])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])
  useTableChanges(['prospects'], reload)

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

  return { prospects, loading, error, truncated: prospects.length >= limit, loadMore: () => setLimit((l) => l + PAGE), setStatus, importMany, reload }
}

/** Histórico cross-canal e estado do agente de um prospect. */
export function useProspectDetail(prospectId: string | null) {
  const [interacoes, setInteracoes] = useState<Interacao[]>([])
  const [estado, setEstado] = useState<ProspectEstado | null>(null)
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!prospectId) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([
      supabase.from('prospect_interacoes').select('*').eq('prospect_id', prospectId).order('enviado_em'),
      supabase.from('prospect_estado').select('*').eq('prospect_id', prospectId).maybeSingle(),
      supabase.from('leads_qualificados').select('*').eq('prospect_id', prospectId).maybeSingle(),
    ]).then(([i, e, l]) => {
      if (!active) return
      setInteracoes(i.data ?? [])
      setEstado(e.data)
      setLead(l.data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [prospectId])

  /** Atualiza o andamento da reunião do lead (realizada, no-show, cancelada...). */
  const setStatusReuniao = async (status: string) => {
    if (!lead) return
    const { error } = await supabase
      .from('leads_qualificados')
      .update({ status_reuniao: status, atualizado_em: new Date().toISOString() })
      .eq('id', lead.id)
    if (error) throw new Error(error.message)
    setLead({ ...lead, status_reuniao: status })
  }

  return { interacoes, estado, lead, setStatusReuniao, loading }
}
