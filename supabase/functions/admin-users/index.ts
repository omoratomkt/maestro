// deno-lint-ignore-file no-explicit-any
// admin-users — gestão de usuários dos workspaces (só super_admin).
// POST { action: 'listar' | 'convidar' | 'alterar_papel' | 'remover', workspace_id, email?, role?, user_id?, redirect_to? }
// Convidar envia o email de convite do Supabase Auth; a pessoa define a senha em /definir-senha.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, errMessage, json, readJson, serviceClient, type SB } from '../_shared/util.ts'

const ROLES = ['operador', 'admin', 'super_admin']

async function acharUsuarioPorEmail(sb: SB, email: string): Promise<{ id: string } | null> {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    const u = data.users.find((x: any) => x.email?.toLowerCase() === email)
    if (u) return { id: u.id }
    if (data.users.length < 1000) break
  }
  return null
}

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
  if (!b?.action || !b.workspace_id) return json({ error: 'action e workspace_id são obrigatórios' }, 400)
  const sb = serviceClient()
  const ws: string = b.workspace_id

  try {
    if (b.action === 'listar') {
      const { data: rows } = await sb.from('workspace_usuarios').select('user_id, role, criado_em').eq('workspace_id', ws).order('criado_em')
      const usuarios = await Promise.all(
        (rows ?? []).map(async (r: any) => {
          const { data } = await sb.auth.admin.getUserById(r.user_id)
          return { user_id: r.user_id, role: r.role, email: data.user?.email ?? null, ultimo_acesso: data.user?.last_sign_in_at ?? null, convite_pendente: !data.user?.email_confirmed_at && !data.user?.last_sign_in_at, voce: r.user_id === me.user.id }
        }),
      )
      return json({ usuarios })
    }

    if (b.action === 'convidar') {
      const email = String(b.email ?? '').trim().toLowerCase()
      const role = b.role ?? 'operador'
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Email inválido' }, 400)
      if (!ROLES.includes(role)) return json({ error: 'Papel inválido' }, 400)

      let user = await acharUsuarioPorEmail(sb, email)
      let convidado = false
      if (!user) {
        const { data, error } = await sb.auth.admin.inviteUserByEmail(email, b.redirect_to ? { redirectTo: b.redirect_to } : undefined)
        if (error) return json({ error: error.message }, 422)
        user = { id: data.user.id }
        convidado = true
      }
      const { error } = await sb.from('workspace_usuarios').upsert({ workspace_id: ws, user_id: user.id, role }, { onConflict: 'workspace_id,user_id' })
      if (error) throw new Error(error.message)
      return json({ ok: true, convite_enviado: convidado, user_id: user.id })
    }

    if (b.action === 'alterar_papel' || b.action === 'remover') {
      if (!b.user_id) return json({ error: 'user_id é obrigatório' }, 400)
      if (b.user_id === me.user.id) return json({ error: 'Você não pode alterar ou remover o próprio acesso' }, 422)
      if (b.action === 'alterar_papel') {
        if (!ROLES.includes(b.role)) return json({ error: 'Papel inválido' }, 400)
        const { error } = await sb.from('workspace_usuarios').update({ role: b.role }).eq('workspace_id', ws).eq('user_id', b.user_id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await sb.from('workspace_usuarios').delete().eq('workspace_id', ws).eq('user_id', b.user_id)
        if (error) throw new Error(error.message)
      }
      return json({ ok: true })
    }

    return json({ error: 'action desconhecida' }, 400)
  } catch (e) {
    return json({ error: errMessage(e) }, 500)
  }
})
