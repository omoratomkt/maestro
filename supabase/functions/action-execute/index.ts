// action-execute — envia uma ação aprovada (ou automática) pelo canal certo.
// POST { fila_id }  ·  Auth: JWT do usuário com acesso à ação (RLS) ou service_role.
import { executeAction } from '../_shared/execute.ts'
import { callerCanSee, corsHeaders, json, readJson, serviceClient } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const body = await readJson(req)
  if (!body?.fila_id) return json({ error: 'fila_id é obrigatório' }, 400)
  if (!(await callerCanSee(req, 'fila_acoes', body.fila_id))) return json({ error: 'Ação não encontrada' }, 404)

  const result = await executeAction(serviceClient(), body.fila_id)
  return json(result, result.ok ? 200 : 422)
})
