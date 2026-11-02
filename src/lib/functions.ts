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
  // Em falha de rede (função indisponível, sem conexão) o contexto não é uma Response: não há corpo para ler.
  const ctx = (error as { context?: unknown }).context
  const parsed = ctx instanceof Response ? await ctx.json().catch(() => null) : null
  if (!parsed && !(ctx instanceof Response)) {
    return { ok: false, data: null, error: 'Não foi possível falar com o servidor. Confira a conexão e tente de novo em alguns instantes.' }
  }
  return { ok: false, data: (parsed as T) ?? null, error: parsed?.detalhe ?? parsed?.error ?? error.message }
}
