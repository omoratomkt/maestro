// deno-lint-ignore-file no-explicit-any
// Processamento de cada evento recebido, por canal. O código vem dos webhooks (mesma lógica); está aqui para que o webhook grave o evento
// ANTES de processar e o agent-loop possa reprocessar o que falhou (ver eventos.ts).
// Regras: processar é idempotente (a mensagem tem id e o handleInbound descarta repetida); exceção = o evento volta para a fila.
import { handleInbound } from './inbound.ts'
import { getCredentials } from './credentials.ts'
import { digits, errMessage, type SB } from './util.ts'

export interface OpcoesProcessamento {
  /** Reprocessamento: retoma a mensagem que foi gravada mas não chegou a ser tratada. */
  retomar?: boolean
}

const STATUS_META: Record<string, string> = { sent: 'enviado', delivered: 'entregue', read: 'lido', failed: 'erro' }
const STATUS_EVOLUTION: Record<string, string> = { SERVER_ACK: 'enviado', DELIVERY_ACK: 'entregue', READ: 'lido', PLAYED: 'lido', ERROR: 'erro' }

interface Contagem {
  processadas: number
  sem_prospect: number
  duplicadas: number
  status: number
  ignoradas: number
}
const novaContagem = (): Contagem => ({ processadas: 0, sem_prospect: 0, duplicadas: 0, status: 0, ignoradas: 0 })
const resumo = (c: Contagem) => Object.entries(c).map(([k, v]) => `${k}=${v}`).join(' ')

/** Trata uma mensagem. Falha de gravação (a mensagem não foi salva) vira exceção: o evento volta para a fila. */
async function tratar(sb: SB, c: Contagem, m: Parameters<typeof handleInbound>[1], opts: OpcoesProcessamento) {
  const r = await handleInbound(sb, { ...m, retomar: opts.retomar })
  if (r.retentar) throw new Error(`Mensagem não gravada: ${r.erro ?? 'erro desconhecido'}`)
  if (!r.encontrado) c.sem_prospect++
  else if (r.duplicada) c.duplicadas++
  else c.processadas++
}

async function updateDeliveryStatus(sb: SB, workspace_id: string, message_id: string, status: string) {
  const { data } = await sb.from('prospect_interacoes').select('id, prospect_id, prospects!inner(workspace_id)').eq('metadata->>message_id', message_id).eq('prospects.workspace_id', workspace_id).limit(1)
  if (data?.[0]) await sb.from('prospect_interacoes').update({ status }).eq('id', data[0].id)
}

export async function processarWhatsapp(sb: SB, ws: string, body: any, opts: OpcoesProcessamento): Promise<string> {
  const c = novaContagem()
  const isMeta = body?.object === 'whatsapp_business_account'
  if (isMeta) {
    for (const entry of body.entry ?? [])
      for (const ch of entry.changes ?? []) {
        for (const st of ch.value?.statuses ?? [])
          if (STATUS_META[st.status]) {
            await updateDeliveryStatus(sb, ws, st.id, STATUS_META[st.status])
            c.status++
          }
        for (const msg of ch.value?.messages ?? []) {
          const texto = msg.type === 'text' ? msg.text?.body : `[${msg.type}]`
          await tratar(
            sb,
            c,
            {
              workspace_id: ws,
              canal: 'whatsapp',
              quem: { whatsapp: msg.from },
              texto: texto ?? '[mensagem sem texto]',
              tipo: msg.type === 'text' ? 'text' : msg.type === 'audio' ? 'audio' : msg.type === 'image' ? 'image' : 'document',
              message_id: msg.id,
              metadata: { provider: 'whatsapp_meta' },
            },
            opts,
          )
        }
      }
    return resumo(c)
  }

  // Evolution
  const event = String(body?.event ?? '').toLowerCase().replace('_', '.')
  const items = Array.isArray(body?.data) ? body.data : [body?.data]
  for (const d of items.filter(Boolean)) {
    if (event === 'messages.update') {
      const st = STATUS_EVOLUTION[String(d.status ?? '')]
      if (st && d.keyId) {
        await updateDeliveryStatus(sb, ws, d.keyId, st)
        c.status++
      }
      continue
    }
    if (event !== 'messages.upsert') {
      c.ignoradas++
      continue
    }
    const jid: string = d.key?.remoteJid ?? ''
    if (d.key?.fromMe || !jid.endsWith('@s.whatsapp.net')) {
      c.ignoradas++ // nossas mensagens e grupos
      continue
    }
    const m = d.message ?? {}
    const texto = m.conversation ?? m.extendedTextMessage?.text ?? (m.audioMessage ? '[áudio]' : m.imageMessage ? '[imagem]' : m.documentMessage ? '[documento]' : '[mensagem sem texto]')
    await tratar(
      sb,
      c,
      {
        workspace_id: ws,
        canal: 'whatsapp',
        quem: { whatsapp: digits(jid.split('@')[0]) },
        texto,
        tipo: m.audioMessage ? 'audio' : m.imageMessage ? 'image' : m.documentMessage ? 'document' : 'text',
        message_id: d.key?.id,
        metadata: { provider: 'whatsapp_evolution', push_name: d.pushName },
      },
      opts,
    )
  }
  return resumo(c)
}

/** Resposta de email do Instantly: só o evento reply_received com remetente e texto vale (o webhook já filtra antes de gravar). */
export async function processarEmail(sb: SB, ws: string, b: any, opts: OpcoesProcessamento): Promise<string> {
  const c = novaContagem()
  if (String(b?.event_type ?? '').toLowerCase() !== 'reply_received' || !b.lead_email || !b.reply_text) return 'ignorado'
  await tratar(
    sb,
    c,
    {
      workspace_id: ws,
      canal: 'email',
      quem: { email: b.lead_email },
      texto: String(b.reply_text).trim(),
      message_id: b.email_id,
      // email_id e email_account são necessários para responder na mesma conversa (POST /emails/reply).
      metadata: { provider: 'email_instantly', email_id: b.email_id, email_account: b.email_account, subject: b.reply_subject ?? b.subject, campaign_id: b.campaign_id },
    },
    opts,
  )
  return resumo(c)
}

export async function processarLinkedin(sb: SB, ws: string, b: any, opts: OpcoesProcessamento): Promise<string> {
  const c = novaContagem()
  if (!b?.linkedin_url || !b.mensagem) return 'ignorado'
  await tratar(
    sb,
    c,
    { workspace_id: ws, canal: 'linkedin', quem: { linkedin_url: b.linkedin_url }, texto: String(b.mensagem).trim(), message_id: b.message_id, metadata: { provider: 'linkedin' } },
    opts,
  )
  return resumo(c)
}

export async function processarInstagram(sb: SB, ws: string, b: any, opts: OpcoesProcessamento): Promise<string> {
  const c = novaContagem()
  if (b?.object === 'instagram') {
    for (const entry of b.entry ?? [])
      for (const ev of entry.messaging ?? []) {
        if (!ev.message?.text || ev.message.is_echo) {
          c.ignoradas++
          continue
        }
        // Resolve o IGSID para o prospect: primeiro pelo vínculo já guardado; senão consulta o @username na Graph API.
        const igsid = String(ev.sender?.id)
        const { data } = await sb.from('prospects').select('instagram_handle').eq('workspace_id', ws).eq('dados_enriquecimento->>instagram_id', igsid).limit(1)
        let handle: string | undefined = data?.[0]?.instagram_handle
        if (!handle) {
          const cfg = await getCredentials(sb, ws, 'instagram_meta')
          const r = await fetch(`https://graph.facebook.com/v21.0/${igsid}?fields=username`, { headers: { Authorization: `Bearer ${cfg.access_token}` } })
          const username: string | undefined = r.ok ? (await r.json()).username : undefined
          if (!username) {
            c.sem_prospect++
            continue
          }
          const { data: p } = await sb.from('prospects').select('id, instagram_handle, dados_enriquecimento').eq('workspace_id', ws).ilike('instagram_handle', username).limit(1)
          if (!p?.[0]) {
            c.sem_prospect++
            continue
          }
          handle = p[0].instagram_handle
          await sb.from('prospects').update({ dados_enriquecimento: { ...(p[0].dados_enriquecimento ?? {}), instagram_id: igsid } }).eq('id', p[0].id)
        }
        if (!handle) {
          c.sem_prospect++
          continue
        }
        await tratar(
          sb,
          c,
          { workspace_id: ws, canal: 'instagram', quem: { instagram_handle: handle }, texto: ev.message.text, message_id: ev.message.mid, metadata: { provider: 'instagram_meta', igsid: ev.sender?.id } },
          opts,
        )
      }
    return resumo(c)
  }
  if (b?.instagram_handle && b.mensagem) {
    await tratar(
      sb,
      c,
      { workspace_id: ws, canal: 'instagram', quem: { instagram_handle: b.instagram_handle }, texto: String(b.mensagem).trim(), message_id: b.message_id, metadata: { provider: 'instagram' } },
      opts,
    )
    return resumo(c)
  }
  return 'ignorado'
}

export type CanalDeEvento = 'whatsapp' | 'email' | 'linkedin' | 'instagram'

/** Despacha o corpo bruto gravado para o processador do canal. Exceção = tentar de novo mais tarde. */
export async function processarEvento(sb: SB, ws: string, canal: CanalDeEvento, corpo: string | null, opts: OpcoesProcessamento = {}): Promise<string> {
  if (corpo == null) throw new Error('Evento sem corpo gravado')
  let body: any
  try {
    body = JSON.parse(corpo)
  } catch (e) {
    throw new Error(`Corpo do evento não é JSON: ${errMessage(e)}`)
  }
  switch (canal) {
    case 'whatsapp':
      return await processarWhatsapp(sb, ws, body, opts)
    case 'email':
      return await processarEmail(sb, ws, body, opts)
    case 'linkedin':
      return await processarLinkedin(sb, ws, body, opts)
    case 'instagram':
      return await processarInstagram(sb, ws, body, opts)
  }
}
