// deno-lint-ignore-file no-explicit-any
// Enriquecimento (Camada 2) + score de ICP (Camada 3).
import { askClaude } from './anthropic.ts'
import { getCredentials } from './credentials.ts'
import { upsertEstado } from './agent.ts'
import { digits, errMessage, normalizePhone, type SB } from './util.ts'

type Etapa = 'ok' | string
interface Fit {
  segmento_fit: number
  cargo_fit: number
  regiao_fit: number
  excluir: boolean
  motivo_exclusao: string
}

const fitSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['segmento_fit', 'cargo_fit', 'regiao_fit', 'excluir', 'motivo_exclusao'],
  properties: {
    segmento_fit: { type: 'integer' },
    cargo_fit: { type: 'integer' },
    regiao_fit: { type: 'integer' },
    excluir: { type: 'boolean' },
    motivo_exclusao: { type: 'string' },
  },
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(Math.round(n), lo), hi)

async function tryStep(etapas: Record<string, Etapa>, nome: string, fn: () => Promise<Etapa | void>) {
  try {
    etapas[nome] = (await fn()) ?? 'ok'
  } catch (e) {
    etapas[nome] = `erro: ${errMessage(e).slice(0, 160)}`
  }
}

const hasIntegration = async (sb: SB, ws: string, tipo: string) => {
  try {
    await getCredentials(sb, ws, tipo)
    return true
  } catch {
    return false
  }
}

/**
 * Enriquece um prospect, calcula o score 0–100 e decide: entra no pipeline (cria o estado do agente)
 * ou é descartado (abaixo do score mínimo da campanha ou excluído pelo ICP).
 *
 * Rubrica do score (soma, máx. 100):
 *  - Contactabilidade (0–30): WhatsApp validado 15 / informado 12 / só telefone 6; email válido 10 (não verificado 5); LinkedIn 3; Instagram 2.
 *  - Aderência ao ICP (0–25): segmento 0–10 + cargo 0–10 + região 0–5, julgados pelo Claude Haiku (sem Anthropic: neutro 12).
 *  - Presença digital (0–25): site ativo 10, https 3, Google ≥4,0 com ≥20 avaliações 7 (≥4,0 com menos: 3), perfil social 5.
 *  - Maturidade (0–20): CNPJ ativo há +2 anos 10 (menos: 5); ≥50 avaliações no Google 10 (≥10: 5); sem nenhum dado: neutro 8.
 */
export async function enrichProspect(sb: SB, prospect_id: string): Promise<{ score: number; status: string; etapas: Record<string, Etapa> }> {
  const { data: p } = await sb.from('prospects').select('*').eq('id', prospect_id).single()
  if (p.fonte === 'demo') return { score: p.score ?? 0, status: p.status, etapas: {} } // dados de demonstração não são enriquecidos
  const { data: c } = await sb.from('campanhas').select('*').eq('id', p.campanha_id).single()
  const ws = p.workspace_id
  const dados: Record<string, any> = { ...(p.dados_enriquecimento ?? {}) }
  const etapas: Record<string, Etapa> = {}
  const upd: Record<string, any> = {}
  let whatsappStatus = (p.whatsapp ? 'informado' : 'nenhum') as 'validado' | 'informado' | 'nenhum'
  let emailStatus = (p.email ? 'nao_verificado' : 'nenhum') as 'valido' | 'nao_verificado' | 'nenhum'

  // Site
  if (p.website) {
    await tryStep(etapas, 'site', async () => {
      const url = /^https?:\/\//i.test(p.website) ? p.website : `https://${p.website}`
      const t0 = Date.now()
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaestroBot/1.0)' } })
      const html = (await res.text()).slice(0, 60000)
      dados.site = {
        ativo: res.ok,
        https: res.url.startsWith('https://'),
        status: res.status,
        titulo: html.match(/<title[^>]*>([^<]{1,160})/i)?.[1]?.trim() ?? null,
        ms: Date.now() - t0,
      }
    })
  } else etapas.site = 'pulada: sem website'

  // CNPJ (BrasilAPI, pública e gratuita)
  const cnpj = digits(p.cnpj)
  if (cnpj.length === 14) {
    await tryStep(etapas, 'cnpj', async () => {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new Error(`BrasilAPI ${res.status}`)
      const j = await res.json()
      dados.cnpj = { razao_social: j.razao_social, situacao: j.descricao_situacao_cadastral, abertura: j.data_inicio_atividade, porte: j.porte, cnae: j.cnae_fiscal_descricao }
    })
  } else etapas.cnpj = 'pulada: sem CNPJ'

  // Validação de WhatsApp (Evolution)
  const phone = normalizePhone(p.whatsapp ?? dados.telefone)
  if (phone && (await hasIntegration(sb, ws, 'whatsapp_evolution'))) {
    await tryStep(etapas, 'whatsapp', async () => {
      const c2 = await getCredentials(sb, ws, 'whatsapp_evolution')
      const res = await fetch(`${c2.base_url.replace(/\/$/, '')}/chat/whatsappNumbers/${encodeURIComponent(c2.instance)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: c2.api_key },
        body: JSON.stringify({ numbers: [phone] }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`Evolution ${res.status}`)
      const r = (await res.json())?.[0]
      if (r?.exists) {
        upd.whatsapp = digits(r.number ?? phone)
        whatsappStatus = 'validado'
        return 'ok'
      }
      if (p.whatsapp) upd.whatsapp = null // número informado que não tem WhatsApp
      whatsappStatus = 'nenhum'
      return 'ok: número não tem WhatsApp'
    })
  } else etapas.whatsapp = phone ? 'pulada: Evolution não configurada' : 'pulada: sem telefone'

  // Email: Hunter (descobrir) e ZeroBounce (validar)
  const host = p.website ? p.website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] : null
  if (!p.email && host && p.nome_contato && (await hasIntegration(sb, ws, 'hunter'))) {
    await tryStep(etapas, 'hunter', async () => {
      const { api_key } = await getCredentials(sb, ws, 'hunter')
      const [first, ...rest] = p.nome_contato.trim().split(/\s+/)
      const u = new URL('https://api.hunter.io/v2/email-finder')
      u.search = new URLSearchParams({ domain: host, first_name: first, last_name: rest.join(' '), api_key }).toString()
      const res = await fetch(u, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`Hunter ${res.status}`)
      const email = (await res.json())?.data?.email
      if (email) {
        upd.email = email
        emailStatus = 'nao_verificado'
        return 'ok'
      }
      return 'ok: não encontrado'
    })
  } else etapas.hunter = 'pulada'
  const email = upd.email ?? p.email
  if (email && (await hasIntegration(sb, ws, 'zerobounce'))) {
    await tryStep(etapas, 'zerobounce', async () => {
      const { api_key } = await getCredentials(sb, ws, 'zerobounce')
      const u = new URL('https://api.zerobounce.net/v2/validate')
      u.search = new URLSearchParams({ api_key, email }).toString()
      const res = await fetch(u, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`ZeroBounce ${res.status}`)
      const status = (await res.json())?.status
      dados.email_status = status
      if (status === 'valid') emailStatus = 'valido'
      else if (['invalid', 'spamtrap', 'abuse', 'do_not_mail'].includes(status)) {
        upd.email = null
        emailStatus = 'nenhum'
      }
      return 'ok'
    })
  } else etapas.zerobounce = 'pulada'

  for (const nome of ['similarweb', 'wappalyzer', 'instagram_seguidores', 'linkedin_decisor', 'sinais_de_timing']) etapas[nome] = 'não implementada'

  // Aderência ao ICP (Haiku)
  let fit: Fit | null = null
  if (await hasIntegration(sb, ws, 'anthropic')) {
    await tryStep(etapas, 'icp_fit', async () => {
      fit = await askClaude<Fit>(sb, {
        workspace_id: ws,
        prospect_id,
        origem: 'enrich',
        tier: 'haiku',
        system:
          'Você avalia a aderência de um prospect ao ICP de uma campanha. segmento_fit 0-10 (o negócio é do segmento-alvo?), cargo_fit 0-10 (o contato é o decisor-alvo? se não há contato, 5), regiao_fit 0-5 (está nas regiões-alvo? se a campanha é nacional, 5). excluir = true somente se bater com algum critério de exclusão (explique em motivo_exclusao; senão string vazia).',
        user: JSON.stringify({
          icp: { segmento: c.segmento, cargos_alvo: c.cargos_alvo, regioes: c.regioes, exclusoes: c.criterios_exclusao },
          prospect: { empresa: p.nome_empresa, segmento: p.segmento, contato: p.nome_contato, cargo: p.cargo, cidade: p.cidade, estado: p.estado, site: dados.site?.titulo ?? p.website },
        }),
        schema: fitSchema,
        maxTokens: 400,
      })
    })
  } else etapas.icp_fit = 'pulada: Anthropic não configurada (aderência neutra)'

  // Score
  const f = fit as Fit | null
  const contato = Math.min(
    30,
    (whatsappStatus === 'validado' ? 15 : whatsappStatus === 'informado' ? 12 : dados.telefone ? 6 : 0) +
      (emailStatus === 'valido' ? 10 : emailStatus === 'nao_verificado' ? 5 : 0) +
      (p.linkedin_url ? 3 : 0) +
      (p.instagram_handle ? 2 : 0),
  )
  const aderencia = f ? clamp(f.segmento_fit, 0, 10) + clamp(f.cargo_fit, 0, 10) + clamp(f.regiao_fit, 0, 5) : 12
  const rating = Number(dados.google_rating ?? 0)
  const avaliacoes = Number(dados.google_avaliacoes ?? 0)
  const presenca = Math.min(
    25,
    (dados.site?.ativo ? 10 : 0) + (dados.site?.https ? 3 : 0) + (rating >= 4 ? (avaliacoes >= 20 ? 7 : 3) : 0) + (p.linkedin_url || p.instagram_handle ? 5 : 0),
  )
  let maturidade = 0
  let temDado = false
  if (dados.cnpj?.situacao) {
    temDado = true
    const anos = dados.cnpj.abertura ? (Date.now() - new Date(dados.cnpj.abertura).getTime()) / (365.25 * 24 * 3600e3) : 0
    if (/ativa/i.test(dados.cnpj.situacao)) maturidade += anos > 2 ? 10 : 5
  }
  if (avaliacoes > 0) {
    temDado = true
    maturidade += avaliacoes >= 50 ? 10 : avaliacoes >= 10 ? 5 : 0
  }
  maturidade = temDado ? Math.min(20, maturidade) : 8
  const score = clamp(contato + aderencia + presenca + maturidade, 0, 100)

  const motivoDescarte = f?.excluir ? `critério de exclusão: ${f.motivo_exclusao}` : score < c.score_minimo ? `score ${score} abaixo do mínimo da campanha (${c.score_minimo})` : null
  const status = motivoDescarte ? 'descartado' : p.status

  const { error } = await sb
    .from('prospects')
    .update({
      ...upd,
      score,
      score_detalhes: { contactabilidade: contato, aderencia_icp: aderencia, presenca_digital: presenca, maturidade, ...(motivoDescarte ? { descarte: motivoDescarte } : {}), fit },
      dados_enriquecimento: { ...dados, etapas },
      enriched_at: new Date().toISOString(),
      status,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', prospect_id)
  if (error) throw new Error(`Falha ao salvar enriquecimento: ${error.message}`)

  // Entrou no pipeline: o agente passa a olhar este prospect.
  if (!motivoDescarte) await upsertEstado(sb, prospect_id, { aguardando: 'nenhum', proxima_acao_em: new Date().toISOString() })
  return { score, status, etapas }
}
