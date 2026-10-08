// deno-lint-ignore-file no-explicit-any
// webhook-linkedin — recebe respostas de LinkedIn (Expandi ou Dripify, via webhook).
//
// Formato GENÉRICO (configure o payload do webhook na ferramenta para enviar estes campos):
//   { "linkedin_url": "https://www.linkedin.com/in/fulano", "mensagem": "texto da resposta", "message_id": "opcional" }
// URL: https://<projeto>.supabase.co/functions/v1/webhook-linkedin?ws=<workspace_id>&token=<webhook_secret>
// O token é o `webhook_secret` da integração (linkedin_expandi ou linkedin_dripify).
// ATENÇÃO: o payload nativo de cada ferramenta ainda não foi validado contra um evento real.
import { authWebhook, handleInbound } from '../_shared/inbound.ts'
import { corsHeaders, errMessage, json, serviceClient } from '../_shared/util.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const sb = serviceClient()
  const url = new URL(req.url)
  const auth = (await authWebhook(sb, url, 'linkedin_expandi')) ?? (await authWebhook(sb, url, 'linkedin_dripify'))
  if (!auth) return json({ error: 'forbidden' }, 403)

  let b: any
  try {
    b = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  if (!b.linkedin_url || !b.mensagem) return json({ error: 'linkedin_url e mensagem são obrigatórios' }, 400)

  EdgeRuntime.waitUntil(
    handleInbound(sb, {
      workspace_id: auth.workspace_id,
      canal: 'linkedin',
      quem: { linkedin_url: b.linkedin_url },
      texto: String(b.mensagem).trim(),
      message_id: b.message_id,
      metadata: { provider: 'linkedin' },
    }).catch((e) => console.error('webhook-linkedin', errMessage(e))),
  )
  return json({ ok: true })
})
