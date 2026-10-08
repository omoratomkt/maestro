// source-search — busca prospects nas fontes ativas da campanha.
// Hoje implementa: google_places. As demais fontes são reportadas como "não implementada".
//
// POST { campanha_id: string, limit?: number }
// Auth: JWT do usuário (RLS garante acesso à campanha) ou service_role (cron).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCredentials } from '../_shared/credentials.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const IMPLEMENTED = ['google_places']

interface Place {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  googleMapsUri?: string
  businessStatus?: string
}

/** "Rua X, 123 - Bairro, Cidade - UF, 00000-000, Brasil" → { cidade, estado } */
function parseCityState(address?: string): { cidade: string | null; estado: string | null } {
  const m = address?.match(/,\s*([^,]+?)\s*-\s*([A-Z]{2})\s*,/)
  return { cidade: m?.[1] ?? null, estado: m?.[2] ?? null }
}

async function searchPlaces(apiKey: string, textQuery: string, max: number): Promise<Place[]> {
  const places: Place[] = []
  let pageToken: string | undefined
  while (places.length < max) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,nextPageToken',
      },
      body: JSON.stringify({ textQuery, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20, pageToken }),
    })
    if (!res.ok) throw new Error(`Google Places ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const body = await res.json()
    places.push(...((body.places ?? []) as Place[]))
    pageToken = body.nextPageToken
    if (!pageToken) break
  }
  return places.slice(0, max)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  let input: { campanha_id?: string; limit?: number }
  try {
    input = await req.json()
  } catch {
    return json({ error: 'Corpo JSON inválido' }, 400)
  }
  if (!input.campanha_id) return json({ error: 'campanha_id é obrigatório' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Leitura com o JWT do chamador: se ele não enxerga a campanha, a busca não acontece.
  const { data: campanha, error: campErr } = await asCaller.from('campanhas').select('*').eq('id', input.campanha_id).maybeSingle()
  if (campErr) return json({ error: campErr.message }, 500)
  if (!campanha) return json({ error: 'Campanha não encontrada' }, 404)
  if (campanha.status !== 'ativa') return json({ error: `Campanha está "${campanha.status}"; só campanhas ativas buscam prospects` }, 409)

  // Cota semanal: volume_semanal menos o que já entrou nos últimos 7 dias.
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const { count: recentes } = await admin
    .from('prospects')
    .select('id', { count: 'exact', head: true })
    .eq('campanha_id', campanha.id)
    .gte('criado_em', since)
  const quota = Math.max(0, (campanha.volume_semanal ?? 50) - (recentes ?? 0))
  const budget = Math.min(quota, input.limit ?? quota)

  const report: Record<string, unknown> = { quota, inseridos: 0, fontes: {} as Record<string, string> }
  const fontes = (campanha.fontes ?? []) as string[]
  for (const f of fontes.filter((f) => !IMPLEMENTED.includes(f))) (report.fontes as Record<string, string>)[f] = 'não implementada'

  let remaining = budget
  if (fontes.includes('google_places') && remaining > 0) {
    try {
      const { api_key } = await getCredentials(admin, campanha.workspace_id, 'google_places')
      const regioes = ((campanha.regioes ?? []) as string[]).filter((r) => r.toLowerCase() !== 'brasil')
      const queries = (regioes.length ? regioes : ['Brasil']).map((r) => `${campanha.segmento ?? ''} em ${r}`.trim())

      let inserted = 0
      for (const q of queries) {
        if (remaining <= 0) break
        const found = await searchPlaces(api_key, q, remaining + 20) // margem para duplicados

        // Deduplicação por place id dentro do workspace.
        const ids = found.map((p) => p.id)
        const { data: existing } = await admin
          .from('prospects')
          .select('fonte_id')
          .eq('workspace_id', campanha.workspace_id)
          .eq('fonte', 'google_places')
          .in('fonte_id', ids)
        const seen = new Set((existing ?? []).map((e) => e.fonte_id))

        const rows = found
          .filter((p) => !seen.has(p.id) && p.businessStatus !== 'CLOSED_PERMANENTLY' && p.displayName?.text)
          .slice(0, remaining)
          .map((p) => ({
            workspace_id: campanha.workspace_id,
            campanha_id: campanha.id,
            nome_empresa: p.displayName!.text,
            website: p.websiteUri ?? null,
            segmento: campanha.segmento,
            ...parseCityState(p.formattedAddress),
            fonte: 'google_places',
            fonte_id: p.id,
            status: 'novo',
            // O telefone fica no enriquecimento: prospects.whatsapp só recebe número validado como WhatsApp.
            dados_enriquecimento: {
              telefone: p.internationalPhoneNumber ?? null,
              endereco: p.formattedAddress ?? null,
              google_rating: p.rating ?? null,
              google_avaliacoes: p.userRatingCount ?? null,
              google_maps: p.googleMapsUri ?? null,
              busca: q,
            },
          }))
        if (rows.length) {
          const { error } = await admin.from('prospects').insert(rows)
          if (error) throw new Error(`Falha ao inserir prospects: ${error.message}`)
        }
        inserted += rows.length
        remaining -= rows.length
      }
      report.inseridos = inserted
      ;(report.fontes as Record<string, string>).google_places = `ok (${inserted} novos)`
    } catch (e) {
      ;(report.fontes as Record<string, string>).google_places = `erro: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  return json(report)
})
