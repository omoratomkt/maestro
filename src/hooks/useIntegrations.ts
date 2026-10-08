import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Json, Tables } from '@/types/database'

export type Integracao = Tables<'integracoes'>
export type WorkspaceRow = Tables<'workspaces'>

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('workspaces')
      .select('*')
      .order('nome')
      .then(({ data }) => {
        if (!active) return
        setWorkspaces(data ?? [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { workspaces, loading }
}

export function useIntegrations(workspaceId: string | null) {
  const [items, setItems] = useState<Integracao[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!workspaceId) return
    const { data, error: err } = await supabase.from('integracoes').select('*').eq('workspace_id', workspaceId)
    if (err) setError(err.message)
    else {
      setError(null)
      setItems(data)
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    void reload()
  }, [reload])

  const save = async (tipo: string, config: Record<string, Json>, ativo: boolean) => {
    if (!workspaceId) throw new Error('Selecione um workspace.')
    const { error: err } = await supabase
      .from('integracoes')
      .upsert(
        { workspace_id: workspaceId, tipo, config, ativo, atualizado_em: new Date().toISOString() },
        { onConflict: 'workspace_id,tipo' },
      )
    if (err) throw new Error(err.message)
    await reload()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('integracoes').delete().eq('id', id)
    if (err) throw new Error(err.message)
    await reload()
  }

  return { items, loading, error, save, remove }
}
