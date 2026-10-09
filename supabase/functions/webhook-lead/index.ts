// deno-lint-ignore-file no-explicit-any
// webhook-lead — fonte "inbound": formulários de site, landing pages, Zapier/Make/n8n criam prospects aqui.
//
// POST https://<projeto>.supabase.co/functions/v1/webhook-lead?ws=<workspace_id>&token=<webhook_secret>
// Corpo JSON (só nome_empresa ou email/whatsapp são necessários):
//   { "nome_empresa", "nome_contato", "cargo", "email", "whatsapp", "website", "cidade", "estado", "segmento",
//     "mensagem": "o que a pessoa escreveu", "canal": "email|whatsapp|linkedin|instagram", "campanha_id": "opcional" }
// A campanha é: campanha_id do corpo → campaign_id da integração → a única campanha ativa que tem "inbound" nas fontes.
import { handleInbound, authWebhook } from '../_shared/inbound.ts'
import { carregarSupressoes, estaSuprimido } from '../_shared/suppression.ts'
import { corsHeaders, digits, errMessage, json, normalizePhone, readJson, serviceClient, type SB } from '../_shared/util.ts'

async function escolherCampanha(sb: SB, ws: string, config: Record<string, string>, pedida?: string): Promise<string | null> {
  const id = pedida ?? config.campaign_id
  if (id) {
    const { data } = await sb.from('campanhas').select('id').eq('id', id).eq('workspace_id', ws).maybeSingle()
    return data?.id ?? null
  }
  const { data } = await sb.from('campanhas').select('id').eq('workspace_id', ws).eq('status', 'ativa').contains('fontes', ['inbound'])
  return data?.length === 1 ? data[0].id : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const sb = serviceClient()
  const auth = await authWebhook(sb, new URL(req.url), 'inbound_webhook')
  if (!auth) return json({ error: 'forbidden' }, 403)

  const b = await readJson(req)
  if (!b) return json({ error: 'JSON inválido' }, 400)
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : null
  const whatsapp = normalizePhone(b.whatsapp ?? b.telefone)
  const nomeEmpresa = String(b.nome_empresa ?? b.empresa ?? b.nome_contato ?? b.nome ?? '').trim()
  if (!email && !whatsapp) return json({ error: 'Informe email ou whatsapp' }, 400)
  if (estaSuprimido(await carregarSupressoes(sb, auth.workspace_id), { email, whatsapp, website: b.website })) return json({ ok: true, suprimido: true })

  try {
    const campanha_id = await escolherCampanha(sb, auth.workspace_id, auth.config, b.campanha_id)
    if (!campanha_id) return json({ error: 'Campanha não definida: envie campanha_id, configure campaign_id na integração ou deixe só uma campanha ativa com a fonte inbound' }, 422)

    // Já existe? Só registra a nova mensagem.
    let existente: any = null
    if (email) existente = (await sb.from('prospects').select('id').eq('workspace_id', auth.workspace_id).ilike('email', email).limit(1)).data?.[0]
    if (!existente && whatsapp) existente = (await sb.from('prospects').select('id').eq('workspace_id', auth.workspace_id).like('whatsapp', `%${whatsapp.slice(-8)}`).limit(1)).data?.[0]

    let prospect_id: string
    if (existente) prospect_id = existente.id
    else {
      const { data, error } = await sb
        .from('prospects')
        .insert({
          workspace_id: auth.workspace_id,
          campanha_id,
          nome_empresa: nomeEmpresa || email || `Contato ${digits(whatsapp)}`,
          nome_contato: b.nome_contato ?? b.nome ?? null,
          cargo: b.cargo ?? null,
          email,
          whatsapp,
          website: b.website ?? null,
          cidade: b.cidade ?? null,
          estado: b.estado ?? null,
          segmento: b.segmento ?? null,
          fonte: 'inbound',
          fonte_id: `inbound:${email ?? whatsapp}`,
          status: 'novo',
          dados_enriquecimento: { mensagem_inicial: b.mensagem ?? null, origem_detalhe: b.origem ?? b.utm ?? null },
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      prospect_id = data.id
    }

    // Se a pessoa escreveu algo e o prospect já existia, registra como mensagem recebida (aciona triagem e agente).
    if (existente && b.mensagem) {
      const canal = ['email', 'whatsapp', 'linkedin', 'instagram'].includes(b.canal) ? b.canal : email ? 'email' : 'whatsapp'
      await handleInbound(sb, { workspace_id: auth.workspace_id, canal, quem: canal === 'email' ? { email: email! } : { whatsapp: whatsapp! }, texto: String(b.mensagem), metadata: { provider: 'webhook-lead' } })
    }
    return json({ ok: true, prospect_id, novo: !existente }, existente ? 200 : 201)
  } catch (e) {
    return json({ error: errMessage(e) }, 500)
  }
})
