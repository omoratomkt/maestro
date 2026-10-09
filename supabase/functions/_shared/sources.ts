// deno-lint-ignore-file no-explicit-any
// Camada 1 — Aquisição. Cada fonte devolve candidatos normalizados; o orquestrador deduplica, insere e registra em source_log.
//
// Implementadas: google_places, apollo, instagram_scraper (Apify), linkedin_scraper (Apify, ator configurável).
// Fora desta função: csv (importação no Pipeline) e inbound (webhook-lead).
// Não implementada: cnpj (a Receita não oferece busca por atividade+cidade; precisa de um provedor de dados escolhido).
import { getCredentials } from './credentials.ts'
import { errMessage, type SB } from './util.ts'

export interface Candidate {
  nome_empresa: string
  nome_contato?: string | null
  cargo?: string | null
  email?: string | null
  linkedin_url?: string | null
  instagram_handle?: string | null
  website?: string | null
  cidade?: string | null
  estado?: string | null
  segmento?: string | null
  fonte_id: string
  dados: Record<string, unknown>
}

export interface SourceReport {
  inseridos: number
  quota: number
  fontes: Record<string, string>
}

const MAX_CONSULTAS_POR_RODADA = 3
const REPETIR_CONSULTA_APOS_DIAS = 7

/** Capitais brasileiras: quando a campanha é nacional ("Brasil" ou sem região), as buscas rotacionam por elas. */
export const CAPITAIS = [
  'São Paulo - SP', 'Rio de Janeiro - RJ', 'Belo Horizonte - MG', 'Brasília - DF', 'Curitiba - PR', 'Porto Alegre - RS',
  'Salvador - BA', 'Fortaleza - CE', 'Recife - PE', 'Goiânia - GO', 'Belém - PA', 'Manaus - AM', 'Florianópolis - SC',
  'Vitória - ES', 'Campo Grande - MS', 'Cuiabá - MT', 'João Pessoa - PB', 'Natal - RN', 'Maceió - AL', 'Teresina - PI',
  'São Luís - MA', 'Aracaju - SE', 'Palmas - TO', 'Porto Velho - RO', 'Rio Branco - AC', 'Macapá - AP', 'Boa Vista - RR',
]

export function localizacoes(regioes: string[] | null): string[] {
  const reais = (regioes ?? []).filter((r) => r.trim() && r.trim().toLowerCase() !== 'brasil')
  return reais.length ? reais : CAPITAIS
}

function splitCidadeUf(local: string | null | undefined): { cidade: string | null; estado: string | null } {
  const m = local?.match(/^(.+?)\s*[-,]\s*([A-Z]{2})$/)
  return m ? { cidade: m[1].trim(), estado: m[2] } : { cidade: local ?? null, estado: null }
}

const pick = (o: any, ...keys: string[]) => {
  for (const k of keys) {
    const v = k.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), o)
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

// ───────────────────────── Google Places ─────────────────────────
export async function googlePlaces(apiKey: string, query: string, max: number, segmento: string | null): Promise<Candidate[]> {
  const out: Candidate[] = []
  let pageToken: string | undefined
  while (out.length < max) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,nextPageToken',
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20, pageToken }),
    })
    if (!res.ok) throw new Error(`Google Places ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const body = await res.json()
    for (const p of body.places ?? []) {
      if (p.businessStatus === 'CLOSED_PERMANENTLY' || !p.displayName?.text) continue
      const m = (p.formattedAddress as string | undefined)?.match(/,\s*([^,]+?)\s*-\s*([A-Z]{2})\s*,/)
      out.push({
        nome_empresa: p.displayName.text,
        website: p.websiteUri ?? null,
        cidade: m?.[1] ?? null,
        estado: m?.[2] ?? null,
        segmento,
        fonte_id: p.id,
        // O telefone fica no enriquecimento: prospects.whatsapp só recebe número validado como WhatsApp.
        dados: { telefone: p.internationalPhoneNumber ?? null, endereco: p.formattedAddress ?? null, google_rating: p.rating ?? null, google_avaliacoes: p.userRatingCount ?? null, google_maps: p.googleMapsUri ?? null, busca: query },
      })
    }
    pageToken = body.nextPageToken
    if (!pageToken) break
  }
  return out.slice(0, max)
}

// ───────────────────────── Apollo ─────────────────────────
// A busca é gratuita, mas não devolve email nem LinkedIn: cada pessoa aceita passa por people/match (1 crédito).
const APOLLO_MAX_ENRIQUECIMENTOS_POR_RODADA = 15

export async function apollo(apiKey: string, camp: any, page: number, max: number): Promise<Candidate[]> {
  const headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' }
  const q = new URLSearchParams({ page: String(page), per_page: String(Math.min(Math.max(max * 2, 10), 50)) })
  for (const t of camp.cargos_alvo ?? []) q.append('person_titles[]', t)
  const locs = (camp.regioes ?? []).filter((r: string) => r.trim().toLowerCase() !== 'brasil')
  for (const l of locs.length ? locs : ['Brazil']) q.append('person_locations[]', l)
  if (camp.segmento) q.set('q_keywords', camp.segmento)

  const res = await fetch(`https://api.apollo.io/api/v1/mixed_people/api_search?${q}`, { method: 'POST', headers })
  if (!res.ok) throw new Error(`Apollo (busca) ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const people: any[] = (await res.json()).people ?? []

  const out: Candidate[] = []
  for (const p of people.filter((x) => x.has_email !== false)) {
    if (out.length >= Math.min(max, APOLLO_MAX_ENRIQUECIMENTOS_POR_RODADA)) break
    const id = p.id ?? p.person_id
    if (!id) continue
    const m = await fetch(`https://api.apollo.io/api/v1/people/match?${new URLSearchParams({ id: String(id) })}`, { method: 'POST', headers })
    if (!m.ok) throw new Error(`Apollo (people/match) ${m.status}: ${(await m.text()).slice(0, 200)}`)
    const person = (await m.json()).person
    if (!person?.organization?.name) continue
    out.push({
      nome_empresa: person.organization.name,
      nome_contato: [person.first_name, person.last_name].filter(Boolean).join(' ') || null,
      cargo: person.title ?? null,
      email: person.email ?? null,
      linkedin_url: person.linkedin_url ?? null,
      website: person.organization.website_url ?? person.organization.primary_domain ?? null,
      cidade: person.city ?? null,
      estado: person.state ?? null,
      segmento: camp.segmento,
      fonte_id: String(id),
      dados: { apollo_email_status: person.email_status ?? null, busca: `apollo página ${page}` },
    })
  }
  return out
}

// ───────────────────────── Apify (Instagram e LinkedIn) ─────────────────────────
async function apifyRun(token: string, actor: string, input: unknown): Promise<any[]> {
  const url = `https://api.apify.com/v2/actors/${encodeURIComponent(actor.replace('/', '~'))}/run-sync-get-dataset-items?timeout=100&clean=true`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const items = await res.json()
  return Array.isArray(items) ? items : []
}

/**
 * Instagram: por padrão usa o ator oficial `apify/instagram-scraper` (perfis em detalhe).
 * Para trocar de ator, defina `actor_instagram` e `input_instagram` (JSON com {{query}} e {{limit}}) na integração.
 * O mapeamento de campos é tolerante (nomes comuns entre atores) — valide com o ator escolhido.
 */
export async function apifyInstagram(cfg: Record<string, string>, query: string, max: number, segmento: string | null): Promise<Candidate[]> {
  const actor = cfg.actor_instagram || 'apify/instagram-scraper'
  const input = cfg.input_instagram
    ? JSON.parse(cfg.input_instagram.replaceAll('{{query}}', query).replaceAll('{{limit}}', String(max)))
    : { search: query, searchType: 'user', searchLimit: Math.min(max * 2, 50), resultsType: 'details', resultsLimit: 1 }
  const items = await apifyRun(cfg.api_token, actor, input)
  const out: Candidate[] = []
  for (const it of items) {
    const handle = pick(it, 'username', 'userName', 'handle')
    if (!handle) continue
    out.push({
      nome_empresa: String(pick(it, 'fullName', 'full_name', 'businessName', 'name') ?? handle),
      instagram_handle: String(handle),
      email: pick(it, 'businessEmail', 'publicEmail', 'email') ?? null,
      website: pick(it, 'externalUrl', 'website', 'externalUrls.0.url') ?? null,
      segmento: pick(it, 'businessCategoryName', 'category') ?? segmento,
      fonte_id: String(pick(it, 'id', 'pk') ?? handle),
      dados: { instagram_seguidores: pick(it, 'followersCount', 'followers', 'followers_count') ?? null, instagram_bio: pick(it, 'biography', 'bio') ?? null, telefone: pick(it, 'businessPhoneNumber', 'publicPhoneNumber', 'phone') ?? null, instagram_conta_comercial: pick(it, 'isBusinessAccount') ?? null, busca: query },
    })
  }
  return out.slice(0, max)
}

/**
 * LinkedIn: sem ator padrão. Defina `actor_linkedin` e `input_linkedin` (JSON com {{query}} e {{limit}}) na integração Apify.
 * Atenção: o scraping do LinkedIn viola os Termos de Uso da plataforma; use por sua conta e risco.
 */
export async function apifyLinkedin(cfg: Record<string, string>, query: string, max: number, segmento: string | null): Promise<Candidate[]> {
  if (!cfg.actor_linkedin || !cfg.input_linkedin) throw new Error('Defina actor_linkedin e input_linkedin na integração Apify para usar a fonte LinkedIn.')
  const input = JSON.parse(cfg.input_linkedin.replaceAll('{{query}}', query).replaceAll('{{limit}}', String(max)))
  const items = await apifyRun(cfg.api_token, cfg.actor_linkedin, input)
  const out: Candidate[] = []
  for (const it of items) {
    const url = pick(it, 'linkedinUrl', 'profileUrl', 'url', 'linkedin_url', 'publicIdentifier')
    const nome = pick(it, 'fullName', 'name') ?? [pick(it, 'firstName'), pick(it, 'lastName')].filter(Boolean).join(' ')
    const empresa = pick(it, 'companyName', 'currentCompany.name', 'company', 'position.0.companyName')
    if (!url || !empresa) continue
    out.push({
      nome_empresa: String(empresa),
      nome_contato: nome ? String(nome) : null,
      cargo: pick(it, 'headline', 'title', 'jobTitle', 'position.0.title') ? String(pick(it, 'headline', 'title', 'jobTitle', 'position.0.title')) : null,
      linkedin_url: String(url).startsWith('http') ? String(url) : `https://www.linkedin.com/in/${url}`,
      ...splitCidadeUf(pick(it, 'location', 'geoLocationName') as string | undefined),
      segmento,
      fonte_id: String(url),
      dados: { busca: query },
    })
  }
  return out.slice(0, max)
}

// ───────────────────────── Orquestração ─────────────────────────
async function consultasRecentes(sb: SB, campanha_id: string, fonte: string): Promise<Set<string>> {
  const desde = new Date(Date.now() - REPETIR_CONSULTA_APOS_DIAS * 24 * 3600e3).toISOString()
  const { data } = await sb.from('source_log').select('consulta').eq('campanha_id', campanha_id).eq('fonte', fonte).is('erro', null).gte('executado_em', desde)
  return new Set((data ?? []).map((r: any) => r.consulta))
}

/** Remove candidatos que já existem no workspace (mesmo fonte_id, email, LinkedIn, Instagram ou site). */
async function novosCandidatos(sb: SB, workspace_id: string, fonte: string, cands: Candidate[]): Promise<Candidate[]> {
  if (!cands.length) return []
  const { data: porId } = await sb.from('prospects').select('fonte_id').eq('workspace_id', workspace_id).eq('fonte', fonte).in('fonte_id', cands.map((c) => c.fonte_id))
  const idsExistentes = new Set((porId ?? []).map((r: any) => r.fonte_id))

  const emails = cands.map((c) => c.email?.toLowerCase()).filter(Boolean) as string[]
  const lins = cands.map((c) => c.linkedin_url).filter(Boolean) as string[]
  const igs = cands.map((c) => c.instagram_handle?.toLowerCase()).filter(Boolean) as string[]
  const chaves = new Set<string>()
  const buscar = async (col: string, vals: string[], norm: (s: string) => string) => {
    if (!vals.length) return
    const { data } = await sb.from('prospects').select(col).eq('workspace_id', workspace_id).in(col, vals)
    for (const r of data ?? []) if ((r as any)[col]) chaves.add(`${col}:${norm((r as any)[col])}`)
  }
  await buscar('email', emails, (s) => s.toLowerCase())
  await buscar('linkedin_url', lins, (s) => s)
  await buscar('instagram_handle', igs, (s) => s.toLowerCase())

  const vistos = new Set<string>()
  return cands.filter((c) => {
    if (idsExistentes.has(c.fonte_id) || vistos.has(c.fonte_id)) return false
    if (c.email && chaves.has(`email:${c.email.toLowerCase()}`)) return false
    if (c.linkedin_url && chaves.has(`linkedin_url:${c.linkedin_url}`)) return false
    if (c.instagram_handle && chaves.has(`instagram_handle:${c.instagram_handle.toLowerCase()}`)) return false
    vistos.add(c.fonte_id)
    return true
  })
}

export async function cotaSemanal(sb: SB, camp: any): Promise<number> {
  const desde = new Date(Date.now() - 7 * 24 * 3600e3).toISOString()
  const { count } = await sb.from('prospects').select('id', { count: 'exact', head: true }).eq('campanha_id', camp.id).gte('criado_em', desde)
  return Math.max(0, (camp.volume_semanal ?? 50) - (count ?? 0))
}

/** Busca prospects nas fontes ativas da campanha até esgotar a cota semanal (ou `limit`). */
export async function runSources(sb: SB, camp: any, limit?: number): Promise<SourceReport> {
  const quota = await cotaSemanal(sb, camp)
  const report: SourceReport = { inseridos: 0, quota, fontes: {} }
  let restante = Math.min(quota, limit ?? quota)
  const fontes: string[] = camp.fontes ?? []
  const executaveis = ['google_places', 'apollo', 'instagram_scraper', 'linkedin_scraper']

  for (const f of fontes) {
    if (f === 'csv') report.fontes[f] = 'importação manual (Pipeline → Importar CSV)'
    else if (f === 'inbound') report.fontes[f] = 'recebido por webhook (webhook-lead)'
    else if (f === 'cnpj') report.fontes[f] = 'não implementada: a Receita não busca por atividade e cidade; é preciso escolher um provedor de dados'
    else if (!executaveis.includes(f)) report.fontes[f] = 'não implementada'
  }

  const ativas = fontes.filter((f) => executaveis.includes(f))
  for (let i = 0; i < ativas.length; i++) {
    const fonte = ativas[i]
    if (restante <= 0) break
    const orcamento = Math.ceil(restante / (ativas.length - i))
    try {
      const n = await runFonte(sb, camp, fonte, orcamento)
      report.inseridos += n.novos
      restante -= n.novos
      report.fontes[fonte] = n.novos ? `ok (${n.novos} novos${n.consultas ? `, ${n.consultas} consulta(s)` : ''})` : n.consultas ? 'ok (nada novo nas consultas desta rodada)' : 'sem consultas novas (todas rodadas nos últimos 7 dias)'
    } catch (e) {
      report.fontes[fonte] = `erro: ${errMessage(e)}`
    }
  }
  return report
}

async function runFonte(sb: SB, camp: any, fonte: string, orcamento: number): Promise<{ novos: number; consultas: number }> {
  const ws = camp.workspace_id
  const log = (consulta: string, novos: number, total: number, erro?: string) =>
    sb.from('source_log').insert({ workspace_id: ws, campanha_id: camp.id, fonte, consulta, novos, total, erro: erro ?? null })

  const gravar = async (cands: Candidate[], limite: number) => {
    const novos = await novosCandidatos(sb, ws, fonte, cands)
    const rows = novos.slice(0, limite).map((c) => ({
      workspace_id: ws,
      campanha_id: camp.id,
      nome_empresa: c.nome_empresa,
      nome_contato: c.nome_contato ?? null,
      cargo: c.cargo ?? null,
      email: c.email ?? null,
      linkedin_url: c.linkedin_url ?? null,
      instagram_handle: c.instagram_handle ?? null,
      website: c.website ?? null,
      cidade: c.cidade ?? null,
      estado: c.estado ?? null,
      segmento: c.segmento ?? camp.segmento,
      fonte,
      fonte_id: c.fonte_id,
      status: 'novo',
      dados_enriquecimento: c.dados,
    }))
    if (rows.length) {
      const { error } = await sb.from('prospects').insert(rows)
      if (error) throw new Error(`Falha ao inserir prospects: ${error.message}`)
    }
    return rows.length
  }

  let novos = 0
  let consultas = 0

  if (fonte === 'apollo') {
    const { api_key } = await getCredentials(sb, ws, 'apollo')
    const { count } = await sb.from('source_log').select('id', { count: 'exact', head: true }).eq('campanha_id', camp.id).eq('fonte', 'apollo').is('erro', null)
    const page = (count ?? 0) + 1 // cada rodada avança uma página
    const cands = await apollo(api_key, camp, page, orcamento)
    const n = await gravar(cands, orcamento)
    await log(`página ${page}`, n, cands.length)
    return { novos: n, consultas: 1 }
  }

  const recentes = await consultasRecentes(sb, camp.id, fonte)
  const consultasPossiveis = localizacoes(camp.regioes).map((loc) => `${camp.segmento ?? ''} em ${loc}`.trim()).filter((q) => !recentes.has(q))

  const cfg = fonte === 'google_places' ? await getCredentials(sb, ws, 'google_places') : await getCredentials(sb, ws, 'apify')
  for (const q of consultasPossiveis.slice(0, MAX_CONSULTAS_POR_RODADA)) {
    if (novos >= orcamento) break
    const falta = orcamento - novos
    try {
      const cands =
        fonte === 'google_places'
          ? await googlePlaces(cfg.api_key, q, falta + 20, camp.segmento) // margem para duplicados
          : fonte === 'instagram_scraper'
            ? await apifyInstagram(cfg, q, falta + 10, camp.segmento)
            : await apifyLinkedin(cfg, q, falta + 10, camp.segmento)
      const n = await gravar(cands, falta)
      novos += n
      consultas++
      await log(q, n, cands.length)
    } catch (e) {
      await log(q, 0, 0, errMessage(e))
      throw e
    }
  }
  return { novos, consultas }
}

