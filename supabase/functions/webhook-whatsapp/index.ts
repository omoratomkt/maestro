// deno-lint-ignore-file no-explicit-any
// webhook-whatsapp — recebe mensagens do WhatsApp (Evolution API e Meta Cloud API).
//
// URL a cadastrar no provedor:  https://<projeto>.supabase.co/functions/v1/webhook-whatsapp?ws=<workspace_id>&token=<webhook_secret>
//  · Evolution: evento MESSAGES_UPSERT (e, opcionalmente, MESSAGES_UPDATE para status de entrega).
//  · Meta: campo "messages" do WhatsApp Business Account. A verificação (GET) usa o verify_token da integração.
import { authWebhook, handleInbound } from '../_shared/inbound.ts'
import { corsHeaders, digits, errMessage, json, serviceClient, timingSafeEqual, type SB } from '../_shared/util.ts'
import { decifrarConfig } from '../_shared/crypto.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const STATUS_META: Record<string, string> = { sent: 'enviado', delivered: 'entregue', read: 'lido', failed: 'erro' }
const STATUS_EVOLUTION: Record<string, string> = { SERVER_ACK: 'enviado', DELIVERY_ACK: 'entregue', READ: 'lido', PLAYED: 'lido', ERROR: 'erro' }

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function updateDeliveryStatus(sb: SB, workspace_id: string, message_id: string, status: string) {
  const { data } = await sb.from('prospect_interacoes').select('id, prospect_id, prospects!inner(workspace_id)').eq('metadata->>message_id', message_id).eq('prospects.workspace_id', workspace_id).limit(1)
  if (data?.[0]) await sb.from('prospect_interacoes').update({ status }).eq('id', data[0].id)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const url = new URL(req.url)
  const sb = serviceClient()

  // Meta: verificação do webhook
  if (req.method === 'GET') {
    const ws = url.searchParams.get('ws')
    const sent = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (url.searchParams.get('hub.mode') === 'subscribe' && ws && sent && challenge) {
      const { data } = await sb.from('integracoes').select('config').eq('workspace_id', ws).eq('tipo', 'whatsapp_meta').eq('ativo', true).maybeSingle()
      const verify = data?.config ? (await decifrarConfig(data.config as Record<string, string>)).verify_token : undefined
      if (verify && timingSafeEqual(sent, verify)) return new Response(challenge, { status: 200 })
    }
    return json({ error: 'forbidden' }, 403)
  }
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const raw = await req.text()
  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const isMeta = body?.object === 'whatsapp_business_account'
  const auth = await authWebhook(sb, url, isMeta ? 'whatsapp_meta' : 'whatsapp_evolution')
  if (!auth) return json({ error: 'forbidden' }, 403)

  // Meta: assinatura HMAC, se o app_secret estiver configurado
  if (isMeta && auth.config.app_secret) {
    const expected = `sha256=${await hmacHex(auth.config.app_secret, raw)}`
    if (!timingSafeEqual(req.headers.get('x-hub-signature-256') ?? '', expected)) return json({ error: 'assinatura inválida' }, 403)
  }

  const ws = auth.workspace_id
  const work = (async () => {
    try {
      if (isMeta) {
        for (const entry of body.entry ?? [])
          for (const ch of entry.changes ?? []) {
            for (const st of ch.value?.statuses ?? []) if (STATUS_META[st.status]) await updateDeliveryStatus(sb, ws, st.id, STATUS_META[st.status])
            for (const msg of ch.value?.messages ?? []) {
              const texto = msg.type === 'text' ? msg.text?.body : `[${msg.type}]`
              await handleInbound(sb, {
                workspace_id: ws,
                canal: 'whatsapp',
                quem: { whatsapp: msg.from },
                texto: texto ?? '[mensagem sem texto]',
                tipo: msg.type === 'text' ? 'text' : msg.type === 'audio' ? 'audio' : msg.type === 'image' ? 'image' : 'document',
                message_id: msg.id,
                metadata: { provider: 'whatsapp_meta' },
              })
            }
          }
        return
      }

      // Evolution
      const event = String(body.event ?? '').toLowerCase().replace('_', '.')
      const items = Array.isArray(body.data) ? body.data : [body.data]
      for (const d of items.filter(Boolean)) {
        if (event === 'messages.update') {
          const st = STATUS_EVOLUTION[String(d.status ?? '')]
          if (st && d.keyId) await updateDeliveryStatus(sb, ws, d.keyId, st)
          continue
        }
        if (event !== 'messages.upsert') continue
        const jid: string = d.key?.remoteJid ?? ''
        if (d.key?.fromMe || !jid.endsWith('@s.whatsapp.net')) continue // nossas mensagens e grupos
        const m = d.message ?? {}
        const texto = m.conversation ?? m.extendedTextMessage?.text ?? (m.audioMessage ? '[áudio]' : m.imageMessage ? '[imagem]' : m.documentMessage ? '[documento]' : '[mensagem sem texto]')
        await handleInbound(sb, {
          workspace_id: ws,
          canal: 'whatsapp',
          quem: { whatsapp: digits(jid.split('@')[0]) },
          texto,
          tipo: m.audioMessage ? 'audio' : m.imageMessage ? 'image' : m.documentMessage ? 'document' : 'text',
          message_id: d.key?.id,
          metadata: { provider: 'whatsapp_evolution', push_name: d.pushName },
        })
      }
    } catch (e) {
      console.error('webhook-whatsapp', errMessage(e))
    }
  })()

  // Responde já (os provedores reenviam se demorar); o processamento com IA segue em segundo plano.
  EdgeRuntime.waitUntil(work)
  return json({ ok: true })
})
