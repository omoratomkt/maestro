// deno-lint-ignore-file no-explicit-any
// webhook-email — recebe respostas de email do Instantly (evento reply_received).
//
// URL a cadastrar no Instantly (webhook de evento "reply_received"):
//   https://<projeto>.supabase.co/functions/v1/webhook-email?ws=<workspace_id>&token=<webhook_secret>
// Campos usados do payload: lead_email, reply_text, email_account, email_id, reply_subject|subject.
import { authWebhook, handleInbound } from '../_shared/inbound.ts'
import { corsHeaders, errMessage, json, serviceClient } from '../_shared/util.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const sb = serviceClient()
  const auth = await authWebhook(sb, new URL(req.url), 'email_instantly')
  if (!auth) return json({ error: 'forbidden' }, 403)

  let b: any
  try {
    b = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  if (String(b.event_type ?? '').toLowerCase() !== 'reply_received' || !b.lead_email || !b.reply_text) return json({ ok: true, ignorado: true })

  EdgeRuntime.waitUntil(
    handleInbound(sb, {
      workspace_id: auth.workspace_id,
      canal: 'email',
      quem: { email: b.lead_email },
      texto: String(b.reply_text).trim(),
      message_id: b.email_id,
      // email_id e email_account são necessários para responder na mesma conversa (POST /emails/reply).
      metadata: { provider: 'email_instantly', email_id: b.email_id, email_account: b.email_account, subject: b.reply_subject ?? b.subject, campaign_id: b.campaign_id },
    }).catch((e) => console.error('webhook-email', errMessage(e))),
  )
  return json({ ok: true })
})
