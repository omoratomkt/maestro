// deno-lint-ignore-file no-explicit-any
// integration-save — grava as credenciais das integrações já criptografadas (só super_admin).
// POST { action: 'salvar', workspace_id, tipo, config, ativo }
// POST { action: 'revelar_webhook', workspace_id, tipo }  → { webhook_secret } (para montar a URL do provedor)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cifrarConfig, decifrar } from '../_shared/crypto.ts'
import { corsHeaders, errMessage, json, readJson, serviceClient } from '../_shared/util.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Não autorizado' }, 401)

  const asCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: me } = await asCaller.auth.getUser()
  const { data: isAdmin } = await asCaller.rpc('is_super_admin')
  if (!me?.user || isAdmin !== true) return json({ error: 'Apenas super_admin' }, 403)

  const b = await readJson(req)
  if (!b?.workspace_id || !b?.tipo) return json({ error: 'workspace_id e tipo são obrigatórios' }, 400)
  const sb = serviceClient()

  try {
    if (b.action === 'revelar_webhook') {
      const { data } = await sb.from('integracoes').select('config').eq('workspace_id', b.workspace_id).eq('tipo', b.tipo).maybeSingle()
      const s = (data?.config as any)?.webhook_secret
      return json({ webhook_secret: s ? await decifrar(s) : null })
    }
    if (b.action === 'salvar') {
      if (typeof b.config !== 'object' || b.config === null || Array.isArray(b.config)) return json({ error: 'config inválida' }, 400)
      const config = await cifrarConfig(b.config)
      const { error } = await sb.from('integracoes').upsert(
        { workspace_id: b.workspace_id, tipo: b.tipo, config, ativo: b.ativo !== false, atualizado_em: new Date().toISOString() },
        { onConflict: 'workspace_id,tipo' },
      )
      if (error) return json({ error: error.message }, 422)
      return json({ ok: true })
    }
    return json({ error: 'action inválida' }, 400)
  } catch (e) {
    return json({ error: errMessage(e) }, 500)
  }
})
