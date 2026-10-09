// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { apifyInstagram, apifyLinkedin, apollo, CAPITAIS, googlePlaces, localizacoes } from './sources.ts'

interface Call {
  url: string
  method: string
  headers: Headers
  body: any
}

/** Intercepta fetch: responde na ordem a lista de respostas e guarda as chamadas. */
function stub(responses: unknown[]) {
  const calls: Call[] = []
  const original = globalThis.fetch
  let i = 0
  globalThis.fetch = ((input: any, init?: any) => {
    const body = init?.body ? JSON.parse(init.body) : undefined
    calls.push({ url: String(input), method: init?.method ?? 'GET', headers: new Headers(init?.headers), body })
    const r = responses[Math.min(i++, responses.length - 1)]
    return Promise.resolve(new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } }))
  }) as typeof fetch
  return { calls, restore: () => (globalThis.fetch = original) }
}

Deno.test('localizacoes: regiões reais são respeitadas; "Brasil" ou vazio expande para as capitais', () => {
  assertEquals(localizacoes(['Campinas - SP']), ['Campinas - SP'])
  assertEquals(localizacoes(['Brasil']), CAPITAIS)
  assertEquals(localizacoes([]), CAPITAIS)
  assertEquals(localizacoes(null), CAPITAIS)
  assertEquals(localizacoes(['Brasil', 'Curitiba - PR']), ['Curitiba - PR'])
  assertEquals(CAPITAIS.length, 27)
})

Deno.test('googlePlaces: cabeçalhos, corpo e mapeamento (ignora estabelecimentos fechados)', async () => {
  const s = stub([
    {
      places: [
        { id: 'p1', displayName: { text: 'Clínica A' }, formattedAddress: 'Rua X, 10 - Centro, Campinas - SP, 13000-000, Brasil', internationalPhoneNumber: '+55 19 3333-0000', websiteUri: 'https://a.com.br', rating: 4.6, userRatingCount: 80 },
        { id: 'p2', displayName: { text: 'Fechada' }, businessStatus: 'CLOSED_PERMANENTLY' },
      ],
    },
  ])
  try {
    const out = await googlePlaces('KEY', 'clínicas em Campinas - SP', 10, 'Clínicas')
    const c = s.calls[0]
    assertEquals(c.url, 'https://places.googleapis.com/v1/places:searchText')
    assertEquals(c.headers.get('x-goog-api-key'), 'KEY')
    assert(c.headers.get('x-goog-fieldmask')!.includes('places.displayName'))
    assertEquals(c.body.textQuery, 'clínicas em Campinas - SP')
    assertEquals(c.body.regionCode, 'BR')
    assertEquals(out.length, 1)
    assertEquals(out[0].nome_empresa, 'Clínica A')
    assertEquals([out[0].cidade, out[0].estado], ['Campinas', 'SP'])
    assertEquals(out[0].dados.telefone, '+55 19 3333-0000')
    assertEquals(out[0].dados.google_avaliacoes, 80)
  } finally {
    s.restore()
  }
})

Deno.test('apollo: busca com x-api-key e person_titles[], depois people/match por id', async () => {
  const s = stub([
    { people: [{ id: 'a1', has_email: true }, { id: 'a2', has_email: false }] },
    { person: { first_name: 'Ana', last_name: 'Souza', title: 'Sócia', email: 'ana@x.com.br', email_status: 'verified', linkedin_url: 'https://linkedin.com/in/ana', city: 'Recife', state: 'Pernambuco', organization: { name: 'X Ltda', website_url: 'https://x.com.br' } } },
  ])
  try {
    const out = await apollo('AK', { cargos_alvo: ['Sócio', 'CEO'], regioes: ['Brasil'], segmento: 'clínicas' }, 3, 5)
    const [busca, match] = s.calls
    assertEquals(busca.method, 'POST')
    assertEquals(busca.headers.get('x-api-key'), 'AK')
    const q = new URL(busca.url)
    assertEquals(q.pathname, '/api/v1/mixed_people/api_search')
    assertEquals(q.searchParams.getAll('person_titles[]'), ['Sócio', 'CEO'])
    assertEquals(q.searchParams.getAll('person_locations[]'), ['Brazil'])
    assertEquals(q.searchParams.get('q_keywords'), 'clínicas')
    assertEquals(q.searchParams.get('page'), '3')
    // só quem tem email passa para o people/match (que consome crédito)
    assertEquals(s.calls.length, 2)
    assertEquals(new URL(match.url).pathname, '/api/v1/people/match')
    assertEquals(new URL(match.url).searchParams.get('id'), 'a1')
    assertEquals(out[0].nome_empresa, 'X Ltda')
    assertEquals(out[0].nome_contato, 'Ana Souza')
    assertEquals(out[0].email, 'ana@x.com.br')
    assertEquals(out[0].linkedin_url, 'https://linkedin.com/in/ana')
    assertEquals(out[0].fonte_id, 'a1')
  } finally {
    s.restore()
  }
})

Deno.test('apifyInstagram: ator padrão, Bearer e mapeamento tolerante', async () => {
  const s = stub([[{ id: '1', username: 'clinica_x', fullName: 'Clínica X', followersCount: 5400, externalUrl: 'https://x.com', businessEmail: 'oi@x.com', businessCategoryName: 'Clínica de estética', businessPhoneNumber: '+5511999990000' }, { fullName: 'sem username' }]])
  try {
    const out = await apifyInstagram({ api_token: 'TK' }, 'estética em São Paulo - SP', 5, 'Estética')
    const c = s.calls[0]
    const u = new URL(c.url)
    assertEquals(u.pathname, '/v2/actors/apify~instagram-scraper/run-sync-get-dataset-items')
    assertEquals(c.headers.get('authorization'), 'Bearer TK')
    assertEquals(c.body.search, 'estética em São Paulo - SP')
    assertEquals(c.body.resultsType, 'details')
    assertEquals(out.length, 1)
    assertEquals(out[0].instagram_handle, 'clinica_x')
    assertEquals(out[0].email, 'oi@x.com')
    assertEquals(out[0].segmento, 'Clínica de estética')
    assertEquals(out[0].dados.instagram_seguidores, 5400)
  } finally {
    s.restore()
  }
})

Deno.test('apifyInstagram: ator e entrada customizados com {{query}} e {{limit}}', async () => {
  const s = stub([[]])
  try {
    await apifyInstagram({ api_token: 'T', actor_instagram: 'meu/ator', input_instagram: '{"q":"{{query}}","n":{{limit}}}' }, 'abc', 7, null)
    assertEquals(new URL(s.calls[0].url).pathname, '/v2/actors/meu~ator/run-sync-get-dataset-items')
    assertEquals(s.calls[0].body, { q: 'abc', n: 7 })
  } finally {
    s.restore()
  }
})

Deno.test('apifyLinkedin: exige ator e entrada configurados; mapeia perfis', async () => {
  await assertRejects(() => apifyLinkedin({ api_token: 'T' }, 'q', 5, null), Error, 'actor_linkedin')
  const s = stub([[{ fullName: 'João Lima', headline: 'CEO', linkedinUrl: 'https://www.linkedin.com/in/joaolima', companyName: 'Lima SA', location: 'Curitiba - PR' }, { fullName: 'sem empresa', linkedinUrl: 'https://x' }]])
  try {
    const out = await apifyLinkedin({ api_token: 'T', actor_linkedin: 'a/b', input_linkedin: '{"query":"{{query}}"}' }, 'CEO curitiba', 5, 'Serviços')
    assertEquals(out.length, 1)
    assertEquals(out[0].nome_empresa, 'Lima SA')
    assertEquals(out[0].cargo, 'CEO')
    assertEquals([out[0].cidade, out[0].estado], ['Curitiba', 'PR'])
    assertEquals(out[0].linkedin_url, 'https://www.linkedin.com/in/joaolima')
  } finally {
    s.restore()
  }
})
