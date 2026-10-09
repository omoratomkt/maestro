// source-search — busca prospects nas fontes ativas da campanha.
// POST { campanha_id, limit? }  ·  Auth: JWT do usuário com acesso à campanha (RLS) ou service_role.
// Fontes: google_places, apollo, instagram_scraper e linkedin_scraper (veja _shared/sources.ts).
import { runSources } from '../_shared/sources.ts'
import { callerCanSee, corsHeaders, errMessage, json, readJson, serviceClient } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const body = await readJson(req)
  if (!body?.campanha_id) return json({ error: 'campanha_id é obrigatório' }, 400)
  if (!(await callerCanSee(req, 'campanhas', body.campanha_id))) return json({ error: 'Campanha não encontrada' }, 404)

  const sb = serviceClient()
  const { data: camp } = await sb.from('campanhas').select('*').eq('id', body.campanha_id).single()
  if (camp.status !== 'ativa') return json({ error: `Campanha está "${camp.status}"; só campanhas ativas buscam prospects` }, 409)
  if (camp.nome.startsWith('[DEMO]')) return json({ error: 'Campanha de demonstração não faz buscas' }, 409)

  try {
    return json(await runSources(sb, camp, Number(body.limit) || undefined))
  } catch (e) {
    return json({ error: errMessage(e) }, 500)
  }
})
