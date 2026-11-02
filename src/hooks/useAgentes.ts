import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { callFunction } from '@/lib/functions'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type PapelIa = 'agent' | 'triage' | 'qualify' | 'briefing' | 'enrich'

export interface PapelInfo {
  papel: PapelIa
  nome: string
  modelo: string
  funcao: string
  editavel: boolean
  prompt: string
}

export type ChamadaIa = Tables<'ia_chamadas_log'>
export type VersaoPrompt = Tables<'agente_prompt_versoes'>

export interface UsoPapel {
  chamadas: number
  falhas: number
  custo: number
  tempoMedioMs: number | null
}

const DIAS = 30

/** Os 5 papéis de IA e o texto real de cada prompt (vem da função, que usa as mesmas constantes que o agente). */
export function usePapeis() {
  const [papeis, setPapeis] = useState<PapelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    void callFunction<{ papeis: PapelInfo[] }>('agentes-info', {}).then((r) => {
      if (!vivo) return
      if (r.ok && r.data) setPapeis(r.data.papeis)
      else setError(r.error ?? 'Não foi possível carregar os agentes.')
      setLoading(false)
    })
    return () => {
      vivo = false
    }
  }, [])

  return { papeis, loading, error }
}

/** Uso dos últimos 30 dias por papel, calculado a partir do registro de chamadas. */
export function useUsoPorPapel() {
  const { workspaceId } = useAuth()
  const [linhas, setLinhas] = useState<Pick<ChamadaIa, 'papel' | 'resultado' | 'custo_usd' | 'tempo_ms'>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) return
    let vivo = true
    const desde = new Date(Date.now() - DIAS * 24 * 3600e3).toISOString()
    void supabase
      .from('ia_chamadas_log')
      .select('papel, resultado, custo_usd, tempo_ms')
      .eq('workspace_id', workspaceId)
      .gte('criado_em', desde)
      .order('criado_em', { ascending: false })
      .limit(5000)
      .then(({ data }) => {
        if (!vivo) return
        setLinhas(data ?? [])
        setLoading(false)
      })
    return () => {
      vivo = false
    }
  }, [workspaceId])

  const porPapel = useMemo(() => {
    const m: Record<string, UsoPapel> = {}
    for (const l of linhas) {
      const u = (m[l.papel] ??= { chamadas: 0, falhas: 0, custo: 0, tempoMedioMs: null })
      u.chamadas++
      if (l.resultado !== 'ok') u.falhas++
      u.custo += Number(l.custo_usd ?? 0)
    }
    for (const papel of Object.keys(m)) {
      const tempos = linhas.filter((l) => l.papel === papel && l.tempo_ms != null).map((l) => l.tempo_ms as number)
      m[papel].tempoMedioMs = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null
    }
    return m
  }, [linhas])

  return { porPapel, loading, dias: DIAS }
}

/** Últimas chamadas de um papel (para ver o que o agente recebeu e respondeu). */
export function useChamadasRecentes(papel: PapelIa) {
  const { workspaceId } = useAuth()
  const [chamadas, setChamadas] = useState<ChamadaIa[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) return
    let vivo = true
    void supabase
      .from('ia_chamadas_log')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('papel', papel)
      .order('criado_em', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!vivo) return
        setChamadas(data ?? [])
        setLoading(false)
      })
    return () => {
      vivo = false
    }
  }, [workspaceId, papel])

  return { chamadas, loading }
}

/** Instruções adicionais do agente de conversa deste workspace, com o histórico de versões. */
export function useInstrucoesDoAgente() {
  const { workspaceId } = useAuth()
  const [instrucoes, setInstrucoes] = useState('')
  const [versoes, setVersoes] = useState<VersaoPrompt[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!workspaceId) return
    const [atual, hist] = await Promise.all([
      supabase.from('agente_prompts').select('instrucoes').eq('workspace_id', workspaceId).eq('papel', 'agente').maybeSingle(),
      supabase.from('agente_prompt_versoes').select('*').eq('workspace_id', workspaceId).eq('papel', 'agente').order('criado_em', { ascending: false }).limit(30),
    ])
    setInstrucoes(atual.data?.instrucoes ?? '')
    setVersoes(hist.data ?? [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const salvar = async (texto: string) => {
    if (!workspaceId) return
    const { error } = await supabase
      .from('agente_prompts')
      .upsert({ workspace_id: workspaceId, papel: 'agente', instrucoes: texto.trim() }, { onConflict: 'workspace_id,papel' })
    if (error) throw new Error(error.message)
    await reload()
  }

  return { instrucoes, versoes, loading, salvar }
}

/** Interruptor geral da IA (só o super_admin lê e altera). */
export function usePausaGeral(habilitado: boolean) {
  const [pausada, setPausada] = useState<boolean | null>(null)

  const reload = useCallback(async () => {
    if (!habilitado) return
    const { data } = await supabase.from('plataforma_config').select('valor').eq('chave', 'ia_pausada').maybeSingle()
    setPausada((data?.valor as { pausada?: boolean } | null)?.pausada === true)
  }, [habilitado])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const alterar = async (valor: boolean) => {
    const { error } = await supabase.from('plataforma_config').update({ valor: { pausada: valor } }).eq('chave', 'ia_pausada')
    if (error) throw new Error(error.message)
    await reload()
  }

  return { pausada, alterar }
}
