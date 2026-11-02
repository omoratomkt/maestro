// deno-lint-ignore-file no-explicit-any
// Guardas de entrada pública (formulário, Zapier, webhooks): um token vazado ou um robô não podem encher a base nem o custo de IA.
import type { SB } from './util.ts'

export const MAX_CORPO_BYTES = 20_000
export const MAX_NOVOS_POR_HORA = 200

/** Texto curto e limpo de um campo vindo de fora: não-texto e vazio viram null; o resto é cortado em `max`. */
export const texto = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** O workspace já recebeu leads demais pelo canal inbound na última hora? */
export async function excedeuLimiteDeNovos(sb: SB, workspace_id: string, agora = Date.now()): Promise<boolean> {
  const { count } = await sb
    .from('prospects')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace_id)
    .eq('fonte', 'inbound')
    .gte('criado_em', new Date(agora - 3600e3).toISOString())
  return (count ?? 0) >= MAX_NOVOS_POR_HORA
}
