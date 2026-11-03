// deno-lint-ignore-file no-explicit-any
// webhook-email — recebe respostas de email do Instantly (evento reply_received).
//
// URL a cadastrar no Instantly (webhook de evento "reply_received"):
//   https://<projeto>.supabase.co/functions/v1/webhook-email?ws=<workspace_id>&token=<webhook_secret>
// Campos usados do payload: lead_email, reply_text, email_account, email_id, reply_subject|subject.
// O evento é gravado antes de ser processado (ver _shared/eventos.ts).
import { executarEvento, registrarEvento } from '../_shared/eventos.ts'
import { authWebhook } from '../_shared/inbound.ts'
import { corsHeaders, errMessage, json, serviceClient } from '../_shared/util.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const sb = serviceClient()
  const auth = await authWebhook(sb, new URL(req.url), 'email_instantly')
  if (!auth) return json({ error: 'forbidden' }, 403)

  const raw = await req.text()
  let b: any
  try {
    b = JSON.parse(raw)
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  if (String(b?.event_type ?? '').toLowerCase() !== 'reply_received' || !b.lead_email || !b.reply_text) return json({ ok: true, ignorado: true })

  let evento
  try {
    evento = await registrarEvento(sb, auth.workspace_id, 'email', raw)
  } catch (e) {
    console.error('webhook-email', errMessage(e))
    return json({ error: 'Erro interno' }, 500)
  }
  EdgeRuntime.waitUntil(executarEvento(sb, evento))
  return json({ ok: true })
})
