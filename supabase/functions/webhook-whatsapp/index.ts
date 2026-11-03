// deno-lint-ignore-file no-explicit-any
// webhook-whatsapp — recebe mensagens do WhatsApp (Evolution API e Meta Cloud API).
//
// URL a cadastrar no provedor:  https://<projeto>.supabase.co/functions/v1/webhook-whatsapp?ws=<workspace_id>&token=<webhook_secret>
//  · Evolution: evento MESSAGES_UPSERT (e, opcionalmente, MESSAGES_UPDATE para status de entrega).
//  · Meta: campo "messages" do WhatsApp Business Account. A verificação (GET) usa o verify_token da integração.
//
// O evento é GRAVADO antes de qualquer processamento (eventos_recebidos). Se a gravação falhar a função responde erro e o provedor reenvia;
// se o processamento falhar ou a função cair no meio, o agent-loop reprocessa (ver _shared/eventos.ts).
import { executarEvento, registrarEvento } from '../_shared/eventos.ts'
import { authWebhook } from '../_shared/inbound.ts'
import { corsHeaders, errMessage, json, serviceClient, timingSafeEqual } from '../_shared/util.ts'
import { decifrarConfig } from '../_shared/crypto.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
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

  // Meta: a assinatura HMAC é obrigatória. Sem o app_secret configurado, a mensagem é recusada (o token na URL, sozinho, não basta).
  if (isMeta && !auth.config.app_secret) return json({ error: 'forbidden' }, 403)
  if (isMeta) {
    const expected = `sha256=${await hmacHex(auth.config.app_secret, raw)}`
    if (!timingSafeEqual(req.headers.get('x-hub-signature-256') ?? '', expected)) return json({ error: 'assinatura inválida' }, 403)
  }

  // Grava antes de responder. Sem isso o provedor acharia que entregou e a mensagem poderia se perder.
  let evento
  try {
    evento = await registrarEvento(sb, auth.workspace_id, 'whatsapp', raw)
  } catch (e) {
    console.error('webhook-whatsapp', errMessage(e))
    return json({ error: 'Erro interno' }, 500)
  }

  // Responde já (os provedores reenviam se demorar); o processamento com IA segue em segundo plano.
  EdgeRuntime.waitUntil(executarEvento(sb, evento))
  return json({ ok: true })
})
