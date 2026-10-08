// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export type SB = SupabaseClient<any, any, any>

/** Client com service_role: ignora RLS. Só para uso dentro das Edge Functions, depois de autorizar o chamador. */
export const serviceClient = (): SB =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

export const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

/** Normaliza telefone brasileiro para o formato internacional só com dígitos (55 + DDD + número). */
export function normalizePhone(raw: string | null | undefined): string | null {
  const d = digits(raw)
  if (d.length < 10) return null
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

export const firstName = (full: string | null | undefined) => (full ?? '').trim().split(/\s+/)[0] ?? ''

/** Comparação em tempo constante (evita vazar o segredo por tempo de resposta). */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

/**
 * Próximo instante útil (seg–sex, 9h–18h, horário de Brasília) a partir de agora + `hours`.
 * O Brasil não tem horário de verão, então BRT = UTC−3 fixo.
 */
export function nextBusinessSlot(hours: number, now = new Date()): Date {
  const OFFSET = 3 * 3600e3
  let b = new Date(now.getTime() + hours * 3600e3 - OFFSET)
  for (let guard = 0; guard < 14; guard++) {
    const dow = b.getUTCDay()
    const h = b.getUTCHours()
    const dayStart = (plusDays: number) =>
      new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + plusDays, 9, 0))
    if (dow === 0 || dow === 6 || h >= 18) b = dayStart(1)
    else if (h < 9) b = dayStart(0)
    else break
  }
  return new Date(b.getTime() + OFFSET)
}

export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Autoriza chamadas de cron: header x-cron-secret igual ao segredo CRON_SECRET, ou Bearer = service_role. */
export function isCronAuthorized(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET')
  const sent = req.headers.get('x-cron-secret')
  if (secret && sent && timingSafeEqual(sent, secret)) return true
  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  return Boolean(bearer && service && timingSafeEqual(bearer, service))
}

/**
 * O chamador (JWT do usuário) enxerga esta linha? Usa o RLS do próprio usuário como autorização.
 * Chamadas com service_role passam, já que o RLS não se aplica a elas.
 */
export async function callerCanSee(req: Request, table: string, id: string): Promise<boolean> {
  const auth = req.headers.get('Authorization')
  if (!auth) return false
  const asCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const { data } = await asCaller.from(table).select('id').eq('id', id).maybeSingle()
  return Boolean(data)
}

/** Lê o corpo JSON de um POST de forma segura. */
export async function readJson(req: Request): Promise<Record<string, any> | null> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
