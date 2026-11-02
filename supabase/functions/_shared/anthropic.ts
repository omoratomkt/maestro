// deno-lint-ignore-file no-explicit-any
import Anthropic from 'npm:@anthropic-ai/sdk@0.132.1'
import { getCredentials } from './credentials.ts'
import { iaPausada, registrarChamada } from './ia_controle.ts'
import { gastoIaHoje, inicioDoDiaBrt, LIMITE_PADRAO_IA_USD, nivelDoTeto } from './limites.ts'
import { notificar } from './notify.ts'
import { resumirParaLog } from './segredos.ts'
import type { SB } from './util.ts'

// Haiku: triagem e classificação. Sonnet: conversação e briefing (decisão do projeto).
export const MODELS = { haiku: 'claude-haiku-4-5', sonnet: 'claude-sonnet-5-5' } as const
// US$ por milhão de tokens [entrada, saída] — tabela de preços da Anthropic em 2026-09.
const PRICE: Record<keyof typeof MODELS, [number, number]> = { haiku: [1, 5], sonnet: [2, 10] }

export type Tier = keyof typeof MODELS

interface AskParams {
  workspace_id: string
  prospect_id?: string | null
  origem: 'agent' | 'triage' | 'qualify' | 'briefing' | 'enrich'
  tier: Tier
  system: string
  user: string
  /** JSON Schema do objeto de resposta (additionalProperties: false e todos os campos em required). */
  schema: Record<string, unknown>
  maxTokens?: number
  /** Só Sonnet: low | medium | high. */
  effort?: 'low' | 'medium' | 'high'
}

/** Avisa por email (uma vez por dia e por nível) que o teto de IA chegou a 80% ou a 100%. Nunca derruba a chamada. */
async function avisarTeto(sb: SB, workspace_id: string, nivel: 'alerta80' | 'bloqueado', gasto: number, teto: number) {
  const bloqueado = nivel === 'bloqueado'
  try {
    await notificar(sb, workspace_id, {
      tipo: 'teto_ia',
      chave: `${nivel}:${inicioDoDiaBrt().toISOString().slice(0, 10)}`,
      assunto: bloqueado ? 'Maestro: o teto diário de IA foi atingido' : 'Maestro: o gasto de IA chegou a 80% do teto de hoje',
      titulo: bloqueado ? 'O agente parou por hoje: teto diário de IA atingido' : 'O gasto de IA de hoje chegou a 80% do teto',
      linhas: [
        `Gasto de hoje: US$ ${gasto.toFixed(2)} de US$ ${teto.toFixed(2)}.`,
        bloqueado ? 'O agente volta amanhã, ou agora se você aumentar o teto em Setup → Integrações → Anthropic. O resto do Maestro segue funcionando.' : 'Ao chegar a 100% o agente para até o dia seguinte. Você pode aumentar o teto em Setup → Integrações → Anthropic.',
      ],
      link: '/setup',
    })
  } catch {
    /* o aviso nunca pode impedir o funcionamento */
  }
}

/**
 * Chama o Claude pedindo uma saída estruturada (JSON validado pelo schema) e registra o custo em custos_uso.
 * Não define temperature/top_p (rejeitados pelo Sonnet 5.5) nem desliga o thinking.
 */
export class IaPausadaError extends Error {}
export class TetoIaError extends Error {}

export async function askClaude<T>(sb: SB, p: AskParams): Promise<T> {
  const inicio = Date.now()
  const base = { workspace_id: p.workspace_id, prospect_id: p.prospect_id ?? null, papel: p.origem, modelo: MODELS[p.tier], entrada: resumirParaLog(p.user) }
  try {
    const r = await chamar<T>(sb, p)
    await registrarChamada(sb, { ...base, saida: resumirParaLog(r.texto), tokens_in: r.tokensIn, tokens_out: r.tokensOut, custo_usd: r.custo, tempo_ms: Date.now() - inicio, resultado: 'ok' })
    return r.saida
  } catch (e) {
    const resultado = e instanceof IaPausadaError ? 'pausada' : e instanceof TetoIaError ? 'bloqueado' : 'erro'
    await registrarChamada(sb, { ...base, tempo_ms: Date.now() - inicio, resultado, erro: resumirParaLog(e instanceof Error ? e.message : String(e), 500) })
    throw e
  }
}

async function chamar<T>(sb: SB, p: AskParams): Promise<{ saida: T; texto: string; tokensIn: number; tokensOut: number; custo: number }> {
  // Interruptor geral: o administrador pausou toda a IA da plataforma. Só o painel e o envio humano seguem.
  if (await iaPausada(sb)) throw new IaPausadaError('A IA está pausada pelo administrador da plataforma.')
  const { api_key, limite_diario_usd } = await getCredentials(sb, p.workspace_id, 'anthropic')
  const teto = Number(limite_diario_usd) > 0 ? Number(limite_diario_usd) : LIMITE_PADRAO_IA_USD
  const gasto = await gastoIaHoje(sb, p.workspace_id)
  const nivel = nivelDoTeto(gasto, teto)
  if (nivel !== 'ok') await avisarTeto(sb, p.workspace_id, nivel, gasto, teto)
  if (nivel === 'bloqueado') throw new TetoIaError(`Limite diário de IA atingido (US$ ${gasto.toFixed(2)} de US$ ${teto.toFixed(2)}). Ajuste em Integrações → Anthropic.`)
  const client = new Anthropic({ apiKey: api_key })

  const outputConfig: Record<string, unknown> = { format: { type: 'json_schema', schema: p.schema } }
  if (p.tier === 'sonnet') outputConfig.effort = p.effort ?? 'medium'

  const res = await client.messages.create({
    model: MODELS[p.tier],
    max_tokens: p.maxTokens ?? 2000,
    system: p.system,
    messages: [{ role: 'user', content: p.user }],
    output_config: outputConfig,
  } as any)

  const u = res.usage as any
  const tokensIn = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
  const tokensOut = u.output_tokens ?? 0
  const [pin, pout] = PRICE[p.tier]
  const custo = (tokensIn * pin + tokensOut * pout) / 1e6
  // O registro de custo nunca pode derrubar a operação.
  await sb
    .from('custos_uso')
    .insert({
      workspace_id: p.workspace_id,
      prospect_id: p.prospect_id ?? null,
      origem: p.origem,
      modelo: MODELS[p.tier],
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      custo_usd: custo,
    })
    .then(() => {}, () => {})

  if ((res as any).stop_reason === 'refusal') throw new Error('O modelo recusou a solicitação (refusal)')
  if (res.stop_reason === 'max_tokens') throw new Error('Resposta do modelo truncada (max_tokens)')
  const text = res.content.find((b: any) => b.type === 'text') as { text: string } | undefined
  if (!text) throw new Error('Resposta do modelo sem texto')
  return { saida: JSON.parse(text.text) as T, texto: text.text, tokensIn, tokensOut, custo }
}
