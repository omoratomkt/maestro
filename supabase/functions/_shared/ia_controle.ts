// deno-lint-ignore-file no-explicit-any
// Controle da IA: interruptor geral, registro de cada chamada ao modelo e instruções adicionais do agente.
// Nada aqui pode derrubar o atendimento: falha de leitura ou de gravação é engolida (o interruptor, em dúvida, não pausa).
import type { SB } from './util.ts'

/** Só pausa com o valor exatamente `true`: valor ausente ou torto não pausa (uma leitura quebrada não pode parar a operação). */
export const interpretarPausa = (valor: unknown): boolean => (valor as { pausada?: unknown } | null)?.pausada === true

export async function iaPausada(sb: SB): Promise<boolean> {
  try {
    const { data } = await sb.from('plataforma_config').select('valor').eq('chave', 'ia_pausada').maybeSingle()
    return interpretarPausa(data?.valor)
  } catch {
    return false
  }
}

export interface ChamadaIa {
  workspace_id: string
  prospect_id?: string | null
  papel: string
  modelo?: string | null
  entrada?: string | null
  saida?: string | null
  tokens_in?: number | null
  tokens_out?: number | null
  custo_usd?: number | null
  tempo_ms?: number | null
  resultado: 'ok' | 'erro' | 'bloqueado' | 'pausada'
  erro?: string | null
}

/** Uma linha por chamada ao modelo. O texto já deve chegar mascarado e cortado (resumirParaLog). */
export async function registrarChamada(sb: SB, c: ChamadaIa): Promise<void> {
  try {
    await sb.from('ia_chamadas_log').insert({ ...c, prospect_id: c.prospect_id ?? null })
  } catch {
    /* o registro nunca pode impedir a operação */
  }
}

/** Instruções adicionais que o operador escreveu para o agente de conversa deste workspace (null se não há). */
export async function instrucoesDoAgente(sb: SB, workspace_id: string): Promise<string | null> {
  try {
    const { data } = await sb.from('agente_prompts').select('instrucoes').eq('workspace_id', workspace_id).eq('papel', 'agente').maybeSingle()
    const t = typeof data?.instrucoes === 'string' ? data.instrucoes.trim() : ''
    return t || null
  } catch {
    return null
  }
}
