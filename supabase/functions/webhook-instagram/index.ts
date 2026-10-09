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
        // Resolve o IGSID para o prospect: primeiro pelo vínculo já guardado; senão consulta o @username na Graph API.
        const igsid = String(ev.sender?.id)
        const { data } = await sb.from('prospects').select('instagram_handle').eq('workspace_id', auth.workspace_id).eq('dados_enriquecimento->>instagram_id', igsid).limit(1)
        let handle: string | undefined = data?.[0]?.instagram_handle
        if (!handle) {
          const r = await fetch(`https://graph.facebook.com/v21.0/${igsid}?fields=username`, { headers: { Authorization: `Bearer ${auth.config.access_token}` } })
          const username: string | undefined = r.ok ? (await r.json()).username : undefined
          if (!username) continue
          const { data: p } = await sb.from('prospects').select('id, instagram_handle, dados_enriquecimento').eq('workspace_id', auth.workspace_id).ilike('instagram_handle', username).limit(1)
          if (!p?.[0]) continue
          handle = p[0].instagram_handle
          await sb.from('prospects').update({ dados_enriquecimento: { ...(p[0].dados_enriquecimento ?? {}), instagram_id: igsid } }).eq('id', p[0].id)
        }
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
