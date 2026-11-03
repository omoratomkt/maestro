// deno-lint-ignore-file no-explicit-any
// webhook-lead — fonte "inbound": formulários de site, landing pages, Zapier/Make/n8n criam prospects aqui.
//
// POST https://<projeto>.supabase.co/functions/v1/webhook-lead?ws=<workspace_id>&token=<webhook_secret>
// Corpo JSON (só nome_empresa ou email/whatsapp são necessários):
//   { "nome_empresa", "nome_contato", "cargo", "email", "whatsapp", "website", "cidade", "estado", "segmento",
//     "cnpj" (opcional; usado no enriquecimento), "mensagem": "o que a pessoa escreveu", "canal": "email|whatsapp|linkedin|instagram", "campanha_id": "opcional" }
// A campanha é: campanha_id do corpo → campaign_id da integração → a única campanha ativa que tem "inbound" nas fontes.
import { cnpjValido } from '../_shared/cnpj.ts'
import { excedeuLimiteDeNovos, MAX_CORPO_BYTES, texto } from '../_shared/entrada_publica.ts'
import { handleInbound, authWebhook } from '../_shared/inbound.ts'
import { carregarSupressoes, estaSuprimido } from '../_shared/suppression.ts'
import { telefoneCanonico } from '../_shared/telefone.ts'
import { corsHeaders, digits, errMessage, json, normalizePhone, serviceClient, type SB } from '../_shared/util.ts'


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

  const raw = await req.text()
  if (raw.length > MAX_CORPO_BYTES) return json({ error: 'Corpo grande demais' }, 413)
  let b: any
  try {
    b = JSON.parse(raw)
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return json({ error: 'JSON inválido' }, 400)
  if (await excedeuLimiteDeNovos(sb, auth.workspace_id)) return json({ error: 'Muitas solicitações. Tente novamente mais tarde.' }, 429)
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : null
  const whatsapp = normalizePhone(b.whatsapp ?? b.telefone)
  const cnpjInformado = digits(b.cnpj)
  const cnpj = cnpjInformado.length === 14 && cnpjValido(cnpjInformado) ? cnpjInformado : null // inválido: ignora, não bloqueia o lead
  const nomeEmpresa = String(b.nome_empresa ?? b.empresa ?? b.nome_contato ?? b.nome ?? '').trim().slice(0, 200)
  if (!email && !whatsapp) return json({ error: 'Informe email ou whatsapp' }, 400)
  if (estaSuprimido(await carregarSupressoes(sb, auth.workspace_id), { email, whatsapp, website: b.website })) return json({ ok: true, suprimido: true })

  try {
    const campanha_id = await escolherCampanha(sb, auth.workspace_id, auth.config, b.campanha_id)
    if (!campanha_id) return json({ error: 'Campanha não definida: envie campanha_id, configure campaign_id na integração ou deixe só uma campanha ativa com a fonte inbound' }, 422)

    // Já existe? Só registra a nova mensagem.
    let existente: any = null
    if (email) existente = (await sb.from('prospects').select('id').eq('workspace_id', auth.workspace_id).ilike('email', email).limit(1)).data?.[0]
    // Mesmo número completo (DDI + DDD + 9º dígito): o mesmo final de número em outra cidade é outra pessoa.
    const canonico = telefoneCanonico(whatsapp)
    if (!existente && canonico) existente = (await sb.from('prospects').select('id').eq('workspace_id', auth.workspace_id).eq('whatsapp_normalizado', canonico).limit(1)).data?.[0]

    let prospect_id: string
    if (existente) prospect_id = existente.id
    else {
      const { data, error } = await sb
        .from('prospects')
        .insert({
          workspace_id: auth.workspace_id,
          campanha_id,
          nome_empresa: nomeEmpresa || email || `Contato ${digits(whatsapp)}`,
          nome_contato: texto(b.nome_contato ?? b.nome, 200),
          cargo: texto(b.cargo, 200),
          email,
          whatsapp,
          website: texto(b.website, 300),
          cnpj,
          cidade: texto(b.cidade, 120),
          estado: texto(b.estado, 60),
          segmento: texto(b.segmento, 200),
          fonte: 'inbound',
          fonte_id: `inbound:${email ?? whatsapp}`,
          status: 'novo',
          dados_enriquecimento: { mensagem_inicial: texto(b.mensagem, 2000), origem_detalhe: texto(b.origem ?? b.utm, 200) },
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      prospect_id = data.id
    }

    // Se a pessoa escreveu algo e o prospect já existia, registra como mensagem recebida (aciona triagem e agente).
    if (existente && b.mensagem) {
      const canal = ['email', 'whatsapp', 'linkedin', 'instagram'].includes(b.canal) ? b.canal : email ? 'email' : 'whatsapp'
      await handleInbound(sb, { workspace_id: auth.workspace_id, canal, quem: canal === 'email' ? { email: email! } : { whatsapp: whatsapp! }, texto: String(b.mensagem).slice(0, 2000), metadata: { provider: 'webhook-lead' } })
    }
    return json({ ok: true, prospect_id, novo: !existente }, existente ? 200 : 201)
  } catch (e) {
    console.error('webhook-lead', errMessage(e))
    return json({ error: 'Erro interno' }, 500)
  }
})
