// deno-lint-ignore-file no-explicit-any
import { askClaude } from './anthropic.ts'
import { getCredentials } from './credentials.ts'
import { errMessage, type SB } from './util.ts'

interface BriefingOut {
  dor_principal: string
  budget: string
  timeline: string
  e_decisor: boolean
  objecoes: string[]
  sentimento: 'positivo' | 'neutro' | 'cético'
  resumo_conversa: string
  pontos_chave: string[]
  score_temperatura: number
  proximo_passo: string
}

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['dor_principal', 'budget', 'timeline', 'e_decisor', 'objecoes', 'sentimento', 'resumo_conversa', 'pontos_chave', 'score_temperatura', 'proximo_passo'],
  properties: {
    dor_principal: { type: 'string' },
    budget: { type: 'string' },
    timeline: { type: 'string' },
    e_decisor: { type: 'boolean' },
    objecoes: { type: 'array', items: { type: 'string' } },
    sentimento: { type: 'string', enum: ['positivo', 'neutro', 'cético'] },
    resumo_conversa: { type: 'string' },
    pontos_chave: { type: 'array', items: { type: 'string' } },
    score_temperatura: { type: 'integer' },
    proximo_passo: { type: 'string' },
  },
}

/** Gera (ou atualiza) o briefing do lead qualificado e avisa o CRM, se configurado. */
export async function generateBriefing(sb: SB, prospect_id: string): Promise<{ lead_id: string; crm: string }> {
  const { data: p } = await sb.from('prospects').select('*').eq('id', prospect_id).single()
  const { data: c } = await sb.from('campanhas').select('nome, persona_produto, criterios_qualificacao').eq('id', p.campanha_id).single()
  const { data: msgs } = await sb
    .from('prospect_interacoes')
    .select('canal, direcao, conteudo, enviado_em')
    .eq('prospect_id', prospect_id)
    .order('enviado_em')
  const conversa = (msgs ?? []).map((m: any) => `[${m.enviado_em}] ${m.direcao === 'in' ? 'PROSPECT' : 'NÓS'} (${m.canal}): ${m.conteudo}`).join('\n')

  const b = await askClaude<BriefingOut>(sb, {
    workspace_id: p.workspace_id,
    prospect_id,
    origem: 'briefing',
    tier: 'sonnet',
    effort: 'low',
    system:
      'Você prepara o briefing de um lead qualificado para quem fará a reunião de vendas. Baseie-se SOMENTE na conversa; quando uma informação não foi dita, escreva "Não informado". score_temperatura vai de 1 (frio) a 10 (pronto para fechar). proximo_passo é uma ação concreta e curta. Escreva em português do Brasil.',
    user: JSON.stringify({
      campanha: c?.nome,
      oferta: c?.persona_produto,
      criterios: c?.criterios_qualificacao,
      prospect: { empresa: p.nome_empresa, contato: p.nome_contato, cargo: p.cargo, segmento: p.segmento },
      conversa,
    }),
    schema,
    maxTokens: 2000,
  })

  const { score_temperatura, proximo_passo, ...briefing } = b
  const row = {
    workspace_id: p.workspace_id,
    prospect_id,
    briefing,
    score_temperatura: Math.min(Math.max(Math.round(score_temperatura), 1), 10),
    proximo_passo,
    atualizado_em: new Date().toISOString(),
  }
  const { data: lead, error } = await sb.from('leads_qualificados').upsert(row, { onConflict: 'prospect_id' }).select('id').single()
  if (error) throw new Error(`Falha ao salvar o lead: ${error.message}`)

  return { lead_id: lead.id, crm: await notifyCrm(sb, p, lead.id, row) }
}

async function notifyCrm(sb: SB, p: any, lead_id: string, row: any): Promise<string> {
  for (const tipo of ['morato_crm', 'webhook_crm']) {
    let cfg: Record<string, string>
    try {
      cfg = await getCredentials(sb, p.workspace_id, tipo)
    } catch {
      continue
    }
    try {
      const res = await fetch(cfg.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cfg.secret ? { 'X-Maestro-Secret': cfg.secret } : {}) },
        body: JSON.stringify({
          evento: 'lead_qualificado',
          lead_id,
          prospect: { empresa: p.nome_empresa, contato: p.nome_contato, cargo: p.cargo, email: p.email, whatsapp: p.whatsapp, linkedin_url: p.linkedin_url, website: p.website },
          briefing: row.briefing,
          score_temperatura: row.score_temperatura,
          proximo_passo: row.proximo_passo,
        }),
      })
      if (!res.ok) return `${tipo}: ${res.status}`
      await sb.from('leads_qualificados').update({ crm_webhook_enviado: true, crm_webhook_enviado_em: new Date().toISOString() }).eq('id', lead_id)
      return `${tipo}: enviado`
    } catch (e) {
      return `${tipo}: erro ${errMessage(e)}`
    }
  }
  return 'sem CRM configurado'
}
