// deno-lint-ignore-file no-explicit-any
// webhook-instagram — recebe DMs do Instagram (Meta).
//
// Aceita dois formatos:
//  · Meta (Instagram Messaging): { object: "instagram", entry: [{ messaging: [{ sender: { id }, message: { mid, text } }] }] }
//    — o remetente chega como IGSID, então só casa com um prospect se `instagram_handle` já tiver sido resolvido
//    para o IGSID (metadata). Sem esse vínculo a mensagem é ignorada. A verificação GET usa o verify_token da integração.
//  · Genérico: { "instagram_handle": "fulano", "mensagem": "texto", "message_id": "opcional" }
// URL: https://<projeto>.supabase.co/functions/v1/webhook-instagram?ws=<workspace_id>&token=<webhook_secret>
// O evento é gravado antes de ser processado, inclusive a resolução do IGSID (ver _shared/eventos.ts e processadores.ts).
import { executarEvento, registrarEvento } from '../_shared/eventos.ts'
import { authWebhook } from '../_shared/inbound.ts'
import { corsHeaders, errMessage, json, serviceClient, timingSafeEqual } from '../_shared/util.ts'
import { decifrarConfig } from '../_shared/crypto.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const url = new URL(req.url)
  const sb = serviceClient()

  if (req.method === 'GET') {
    const ws = url.searchParams.get('ws')
    const sent = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (url.searchParams.get('hub.mode') === 'subscribe' && ws && sent && challenge) {
      const { data } = await sb.from('integracoes').select('config').eq('workspace_id', ws).eq('tipo', 'instagram_meta').eq('ativo', true).maybeSingle()
      const verify = data?.config ? (await decifrarConfig(data.config as Record<string, string>)).verify_token : undefined
      if (verify && timingSafeEqual(sent, verify)) return new Response(challenge, { status: 200 })
    }
    return json({ error: 'forbidden' }, 403)
  }
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const auth = await authWebhook(sb, url, 'instagram_meta')
  if (!auth) return json({ error: 'forbidden' }, 403)
  const raw = await req.text()
  let b: any
  try {
    b = JSON.parse(raw)
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  if (b?.object !== 'instagram' && !(b?.instagram_handle && b.mensagem)) return json({ error: 'payload não reconhecido' }, 400)

  let evento
  try {
    evento = await registrarEvento(sb, auth.workspace_id, 'instagram', raw)
  } catch (e) {
    console.error('webhook-instagram', errMessage(e))
    return json({ error: 'Erro interno' }, 500)
  }
  EdgeRuntime.waitUntil(executarEvento(sb, evento))
  return json({ ok: true })
})
