// deno-lint-ignore-file no-explicit-any
// webhook-instagram — recebe DMs do Instagram (Meta).
//
// Aceita dois formatos:
//  · Meta (Instagram Messaging): { object: "instagram", entry: [{ messaging: [{ sender: { id }, message: { mid, text } }] }] }
//    — o remetente chega como IGSID, então só casa com um prospect se `instagram_handle` já tiver sido resolvido
//    para o IGSID (metadata). Sem esse vínculo a mensagem é ignorada. A verificação GET usa o verify_token da integração.
//  · Genérico: { "instagram_handle": "fulano", "mensagem": "texto", "message_id": "opcional" }
// URL: https://<projeto>.supabase.co/functions/v1/webhook-instagram?ws=<workspace_id>&token=<webhook_secret>
import { authWebhook, handleInbound } from '../_shared/inbound.ts'
import { corsHeaders, errMessage, json, serviceClient, timingSafeEqual } from '../_shared/util.ts'

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
      if (data?.config?.verify_token && timingSafeEqual(sent, data.config.verify_token)) return new Response(challenge, { status: 200 })
    }
    return json({ error: 'forbidden' }, 403)
  }
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const auth = await authWebhook(sb, url, 'instagram_meta')
  if (!auth) return json({ error: 'forbidden' }, 403)
  let b: any
  try {
    b = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const jobs: Promise<unknown>[] = []
  if (b.object === 'instagram') {
    for (const entry of b.entry ?? [])
      for (const ev of entry.messaging ?? []) {
        if (!ev.message?.text || ev.message.is_echo) continue
        // Resolve o IGSID para o prospect (guardado em dados_enriquecimento.instagram_id).
        const { data } = await sb.from('prospects').select('instagram_handle').eq('workspace_id', auth.workspace_id).eq('dados_enriquecimento->>instagram_id', String(ev.sender?.id)).limit(1)
        const handle = data?.[0]?.instagram_handle
        if (!handle) continue
        jobs.push(
          handleInbound(sb, {
            workspace_id: auth.workspace_id,
            canal: 'instagram',
            quem: { instagram_handle: handle },
            texto: ev.message.text,
            message_id: ev.message.mid,
            metadata: { provider: 'instagram_meta', igsid: ev.sender?.id },
          }),
        )
      }
  } else if (b.instagram_handle && b.mensagem) {
    jobs.push(
      handleInbound(sb, {
        workspace_id: auth.workspace_id,
        canal: 'instagram',
        quem: { instagram_handle: b.instagram_handle },
        texto: String(b.mensagem).trim(),
        message_id: b.message_id,
        metadata: { provider: 'instagram' },
      }),
    )
  } else return json({ error: 'payload não reconhecido' }, 400)

  EdgeRuntime.waitUntil(Promise.all(jobs).catch((e) => console.error('webhook-instagram', errMessage(e))))
  return json({ ok: true })
})
