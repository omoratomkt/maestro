// generate-briefing — gera o briefing completo do lead qualificado (Claude Sonnet) e avisa o CRM.
// POST { prospect_id }
import { generateBriefing } from '../_shared/briefing.ts'
import { callerCanSee, corsHeaders, errMessage, json, readJson, serviceClient } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const body = await readJson(req)
  if (!body?.prospect_id) return json({ error: 'prospect_id é obrigatório' }, 400)
  if (!(await callerCanSee(req, 'prospects', body.prospect_id))) return json({ error: 'Prospect não encontrado' }, 404)
  try {
    return json(await generateBriefing(serviceClient(), body.prospect_id))
  } catch (e) {
    return json({ error: errMessage(e) }, 500)
  }
})
