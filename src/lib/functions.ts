import { supabase } from '@/lib/supabase'

export interface FnResult<T> {
  ok: boolean
  data: T | null
  /** Mensagem de erro já em português quando ok = false. */
  error: string | null
}

/** Chama uma Edge Function e normaliza o erro (o corpo de respostas 4xx/5xx traz o motivo). */
export async function callFunction<T = Record<string, unknown>>(name: string, body: unknown): Promise<FnResult<T>> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> })
  if (!error) return { ok: true, data: data as T, error: null }
  const ctx = (error as { context?: Response }).context
  const parsed = ctx ? await ctx.json().catch(() => null) : null
  return { ok: false, data: (parsed as T) ?? null, error: parsed?.detalhe ?? parsed?.error ?? error.message }
}
