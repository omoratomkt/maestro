import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'

export type PlaybookRow = Tables<'playbooks'>

/** Gestão completa de playbooks (inclui inativos) — uso do super_admin. */
export function usePlaybookAdmin() {
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase.from('playbooks').select('*').order('nome')
    if (err) setError(err.message)
    else {
      setError(null)
      setPlaybooks(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const create = async (input: TablesInsert<'playbooks'>) => {
    const { error: err } = await supabase.from('playbooks').insert(input)
    if (err) throw new Error(err.message)
    await reload()
  }

  const update = async (id: string, patch: TablesUpdate<'playbooks'>) => {
    const { error: err } = await supabase.from('playbooks').update(patch).eq('id', id)
    if (err) throw new Error(err.message)
    await reload()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('playbooks').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await reload()
  }

  return { playbooks, loading, error, create, update, remove }
}
