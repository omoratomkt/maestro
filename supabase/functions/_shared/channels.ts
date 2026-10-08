// deno-lint-ignore-file no-explicit-any
// Envio por canal. Implementados: WhatsApp (Evolution API e Meta Cloud API) e Email (Instantly).
// LinkedIn e Instagram: sem envio — veja os comentários em cada caso.
import { getCredentials } from './credentials.ts'
import { digits, type SB } from './util.ts'

export type Canal = 'whatsapp' | 'email' | 'linkedin' | 'instagram'

/** Canais que o agente pode propor hoje (têm envio implementado). */
export const SENDABLE: Canal[] = ['whatsapp', 'email']

interface ChannelContext {
  workspace_id: string
  /** campanhas.canais, ex.: ['whatsapp_evolution', 'email'] */
  campanhaCanais: string[]
}

/** Canais utilizáveis agora: na campanha, com integração ativa e envio implementado. */
export async function availableChannels(sb: SB, ctx: ChannelContext): Promise<Canal[]> {
  const { data } = await sb.from('integracoes').select('tipo').eq('workspace_id', ctx.workspace_id).eq('ativo', true)
  const active = new Set((data ?? []).map((r: { tipo: string }) => r.tipo))
  const inCampaign = (tipo: string) => ctx.campanhaCanais.includes(tipo) && active.has(tipo)
  const out: Canal[] = []
  if (inCampaign('whatsapp_evolution') || inCampaign('whatsapp_meta')) out.push('whatsapp')
  if (ctx.campanhaCanais.includes('email') && active.has('email_instantly')) out.push('email')
  return out
}

export interface SendInput extends ChannelContext {
  canal: string
  texto: string
  prospect: {
    nome_empresa: string
    nome_contato: string | null
    whatsapp: string | null
    email: string | null
    website: string | null
    cargo: string | null
  }
  /** Última mensagem recebida por email (metadata guarda email_id/email_account do Instantly), se houver. */
  ultimaRespostaEmail?: { email_id?: string; email_account?: string; subject?: string } | null
}

export interface SendResult {
  provider: string
  message_id?: string
  metadata: Record<string, unknown>
}

async function http(url: string, init: RequestInit, label: string): Promise<any> {
  const res = await fetch(url, init)
  const body = await res.text()
  if (!res.ok) throw new Error(`${label} respondeu ${res.status}: ${body.slice(0, 300)}`)
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

export async function sendMessage(sb: SB, s: SendInput): Promise<SendResult> {
  switch (s.canal) {
    case 'whatsapp':
      return await sendWhatsapp(sb, s)
    case 'email':
      return await sendEmail(sb, s)
    case 'linkedin':
      // Dripify: a Open API (jul/2026) ainda não envia mensagens. Expandi: envio acontece dentro das campanhas
      // da ferramenta; não há endpoint documentado para mensagem avulsa. Requer decisão de arquitetura.
      throw new Error('Envio por LinkedIn ainda não implementado: as ferramentas configuráveis não expõem envio avulso por API.')
    case 'instagram':
      // A Meta exige o IGSID (id do usuário no Instagram), que só é conhecido depois que a pessoa escreve primeiro.
      throw new Error('Envio por Instagram ainda não implementado: a API da Meta só permite responder a quem já enviou mensagem.')
    default:
      throw new Error(`Canal desconhecido: ${s.canal}`)
  }
}

async function sendWhatsapp(sb: SB, s: SendInput): Promise<SendResult> {
  const number = digits(s.prospect.whatsapp)
  if (!number) throw new Error('Prospect sem WhatsApp validado (rode o enriquecimento ou informe o número).')

  const { data } = await sb.from('integracoes').select('tipo').eq('workspace_id', s.workspace_id).eq('ativo', true)
  const active = new Set((data ?? []).map((r: { tipo: string }) => r.tipo))
  const useEvolution = s.campanhaCanais.includes('whatsapp_evolution') && active.has('whatsapp_evolution')
  const useMeta = s.campanhaCanais.includes('whatsapp_meta') && active.has('whatsapp_meta')

  if (useEvolution) {
    const c = await getCredentials(sb, s.workspace_id, 'whatsapp_evolution')
    const body = await http(
      `${c.base_url.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(c.instance)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: c.api_key },
        body: JSON.stringify({ number, text: s.texto }),
      },
      'Evolution API',
    )
    return { provider: 'whatsapp_evolution', message_id: body?.key?.id, metadata: { remote_jid: body?.key?.remoteJid } }
  }

  if (useMeta) {
    const c = await getCredentials(sb, s.workspace_id, 'whatsapp_meta')
    const body = await http(
      `https://graph.facebook.com/v21.0/${c.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.access_token}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: number, type: 'text', text: { body: s.texto, preview_url: false } }),
      },
      'Meta Cloud API (fora da janela de 24h a Meta exige template aprovado)',
    )
    return { provider: 'whatsapp_meta', message_id: body?.messages?.[0]?.id, metadata: {} }
  }

  throw new Error('Nenhuma integração de WhatsApp ativa para esta campanha.')
}

async function sendEmail(sb: SB, s: SendInput): Promise<SendResult> {
  const to = s.prospect.email
  if (!to) throw new Error('Prospect sem email.')
  const c = await getCredentials(sb, s.workspace_id, 'email_instantly')
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${c.api_key}` }

  // Resposta dentro de uma conversa existente: usa o id do email recebido (webhook reply_received).
  const last = s.ultimaRespostaEmail
  if (last?.email_id) {
    const subject = last.subject ? (/^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`) : 'Re:'
    const body = await http(
      'https://api.instantly.ai/api/v2/emails/reply',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reply_to_uuid: last.email_id,
          eaccount: last.email_account ?? c.eaccount,
          subject,
          body: { text: s.texto },
        }),
      },
      'Instantly (reply)',
    )
    return { provider: 'email_instantly', message_id: body?.message_id ?? body?.id, metadata: { via: 'reply', instantly_email_id: body?.id } }
  }

  // Primeiro contato: o Instantly só envia a partir de uma campanha. Criamos o lead com a mensagem em
  // `personalization`; o template da campanha no Instantly deve usar {{personalization}} como corpo.
  const [first, ...rest] = (s.prospect.nome_contato ?? '').trim().split(/\s+/)
  const body = await http(
    'https://api.instantly.ai/api/v2/leads',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        campaign: c.campaign_id,
        email: to,
        first_name: first || undefined,
        last_name: rest.join(' ') || undefined,
        company_name: s.prospect.nome_empresa,
        website: s.prospect.website ?? undefined,
        job_title: s.prospect.cargo ?? undefined,
        personalization: s.texto,
        skip_if_in_workspace: true,
      }),
    },
    'Instantly (lead)',
  )
  return { provider: 'email_instantly', metadata: { via: 'campaign', instantly_lead_id: body?.id, nota: 'envio agendado pelo Instantly conforme a campanha' } }
}
