// deno-lint-ignore-file no-explicit-any
import Anthropic from 'npm:@anthropic-ai/sdk@0.132.1'
import { getCredentials } from './credentials.ts'
import type { SB } from './util.ts'

// Haiku: triagem e classificação. Sonnet: conversação e briefing (decisão do projeto).
const MODELS = { haiku: 'claude-haiku-4-5', sonnet: 'claude-sonnet-5-5' } as const
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

/**
 * Chama o Claude pedindo uma saída estruturada (JSON validado pelo schema) e registra o custo em custos_uso.
 * Não define temperature/top_p (rejeitados pelo Sonnet 5.5) nem desliga o thinking.
 */
export async function askClaude<T>(sb: SB, p: AskParams): Promise<T> {
  const { api_key } = await getCredentials(sb, p.workspace_id, 'anthropic')
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
  return JSON.parse(text.text) as T
}
