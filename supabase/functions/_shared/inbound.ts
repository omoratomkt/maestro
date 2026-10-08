// deno-lint-ignore-file no-explicit-any
// Tratamento comum de mensagens recebidas (usado pelos 4 webhooks).
import { askClaude } from './anthropic.ts'
import { proposeNextAction, upsertEstado } from './agent.ts'
import { qualifyProspect } from './qualify.ts'
import { digits, errMessage, timingSafeEqual, type SB } from './util.ts'

export interface InboundMessage {
  workspace_id: string
  canal: 'whatsapp' | 'email' | 'linkedin' | 'instagram'
  /** Como identificar o prospect: use o campo do canal. */
  quem: { whatsapp?: string; email?: string; linkedin_url?: string; instagram_handle?: string }
  texto: string
  tipo?: 'text' | 'audio' | 'image' | 'document'
  /** id da mensagem no provedor (idempotência) e demais metadados. */
  message_id?: string
  metadata?: Record<string, unknown>
}

export interface InboundResult {
  encontrado: boolean
  duplicada?: boolean
  triagem?: string
  qualificado?: boolean
  proximo?: string
  erro?: string
}

type Intencao = 'interesse' | 'duvida' | 'objecao' | 'recusa' | 'pedido_humano' | 'agendamento' | 'resposta_automatica' | 'fora_de_contexto'

const triageSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['intencao', 'resumo'],
  properties: {
    intencao: { type: 'string', enum: ['interesse', 'duvida', 'objecao', 'recusa', 'pedido_humano', 'agendamento', 'resposta_automatica', 'fora_de_contexto'] },
    resumo: { type: 'string' },
  },
}

async function findProspect(sb: SB, m: InboundMessage): Promise<any | null> {
  let q = sb.from('prospects').select('*').eq('workspace_id', m.workspace_id)
  if (m.quem.whatsapp) {
    // Compara pelos 8 últimos dígitos: evita falhar por DDI ou pelo 9º dígito.
    const tail = digits(m.quem.whatsapp).slice(-8)
    if (tail.length < 8) return null
    q = q.like('whatsapp', `%${tail}`)
  } else if (m.quem.email) q = q.ilike('email', m.quem.email.trim())
  else if (m.quem.linkedin_url) {
    const slug = m.quem.linkedin_url.replace(/\/+$/, '').split('/').pop() ?? ''
    if (!slug) return null
    q = q.ilike('linkedin_url', `%${slug}%`)
  } else if (m.quem.instagram_handle) q = q.ilike('instagram_handle', m.quem.instagram_handle.replace(/^@/, ''))
  else return null
  const { data } = await q.order('ultima_interacao_em', { ascending: false, nullsFirst: false }).limit(1)
  return data?.[0] ?? null
}

/** Registra a mensagem, triagem (Haiku), qualificação e proposta do agente — tudo em tempo real. */
export async function handleInbound(sb: SB, m: InboundMessage): Promise<InboundResult> {
  const p = await findProspect(sb, m)
  if (!p) return { encontrado: false }

  if (m.message_id) {
    const { data: dup } = await sb.from('prospect_interacoes').select('id').eq('prospect_id', p.id).eq('metadata->>message_id', m.message_id).limit(1)
    if (dup?.length) return { encontrado: true, duplicada: true }
  }

  const agora = new Date().toISOString()
  const { data: row, error } = await sb
    .from('prospect_interacoes')
    .insert({
      prospect_id: p.id,
      canal: m.canal,
      direcao: 'in',
      conteudo: m.texto,
      tipo: m.tipo ?? 'text',
      metadata: { ...(m.metadata ?? {}), message_id: m.message_id },
      enviado_em: agora,
    })
    .select('id')
    .single()
  if (error) return { encontrado: true, erro: error.message }

  // Quem respondeu volta a ser prioridade; descartado/convertido ficam como estão.
  const reabre = !['descartado', 'convertido', 'qualificado', 'agendado'].includes(p.status)
  await sb
    .from('prospects')
    .update({ ultima_interacao_em: agora, canal_principal: m.canal, atualizado_em: agora, ...(reabre ? { status: 'engajado' } : {}) })
    .eq('id', p.id)
  // Ações abertas ficaram desatualizadas com a nova mensagem: cancela para o agente repropor.
  await sb.from('fila_acoes').update({ status: 'cancelada' }).eq('prospect_id', p.id).eq('status', 'pendente')
  await upsertEstado(sb, p.id, { aguardando: 'nenhum', proxima_acao_em: null })

  const result: InboundResult = { encontrado: true }
  try {
    // 1) Triagem barata (Haiku)
    const t = await askClaude<{ intencao: Intencao; resumo: string }>(sb, {
      workspace_id: p.workspace_id,
      prospect_id: p.id,
      origem: 'triage',
      tier: 'haiku',
      system: 'Classifique a intenção de uma resposta a uma abordagem comercial outbound. "resposta_automatica" = ausência/auto-reply/bot. "recusa" = não tem interesse ou pede para não receber mais mensagens. "pedido_humano" = quer ligação, reunião, proposta formal ou falar com uma pessoa.',
      user: JSON.stringify({ mensagem: m.texto, canal: m.canal }),
      schema: triageSchema,
      maxTokens: 300,
    })
    result.triagem = t.intencao
    await sb.from('prospect_interacoes').update({ metadata: { ...(m.metadata ?? {}), message_id: m.message_id, triagem: t } }).eq('id', row.id)

    if (t.intencao === 'resposta_automatica') {
      // Auto-reply não é resposta humana: volta a esperar sem acionar o agente.
      await upsertEstado(sb, p.id, { aguardando: 'resposta', proxima_acao_em: new Date(Date.now() + 48 * 3600e3).toISOString() })
      result.proximo = 'ignorada (resposta automática)'
      return result
    }

    // 2) Qualificação (só faz sentido se houver resposta de verdade)
    if (t.intencao !== 'recusa') {
      const q = await qualifyProspect(sb, p.id)
      result.qualificado = q.qualificado
    }

    // 3) Próximo passo
    if (t.intencao === 'pedido_humano') {
      await upsertEstado(sb, p.id, { aguardando: 'nenhum', proxima_acao_em: null, contexto_resumo: `Pediu atendimento humano: ${t.resumo}` })
      result.proximo = 'aguardando humano'
    } else {
      const o = await proposeNextAction(sb, p.id)
      result.proximo = o.resultado
    }
  } catch (e) {
    // A mensagem já está salva; o agent-loop retoma este prospect na próxima rodada.
    result.erro = errMessage(e)
    await upsertEstado(sb, p.id, { aguardando: 'nenhum', proxima_acao_em: new Date().toISOString() })
  }
  return result
}

/** Valida ?ws=<workspace>&token=<segredo> contra o `webhook_secret` da integração. */
export async function authWebhook(sb: SB, url: URL, tipo: string): Promise<{ workspace_id: string; config: Record<string, string> } | null> {
  const ws = url.searchParams.get('ws')
  const token = url.searchParams.get('token')
  if (!ws || !token) return null
  const { data } = await sb.from('integracoes').select('config, ativo').eq('workspace_id', ws).eq('tipo', tipo).maybeSingle()
  const secret = data?.config?.webhook_secret
  if (!data?.ativo || !secret || !timingSafeEqual(token, secret)) return null
  return { workspace_id: ws, config: data.config }
}
