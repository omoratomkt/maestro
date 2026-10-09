import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { decifrarConfig } from './crypto.ts'

/**
 * Lê as credenciais ativas de uma integração do workspace.
 * Use sempre com o client service_role (a tabela integracoes só é legível por super_admin no frontend).
 */
export async function getCredentials(
  // deno-lint-ignore no-explicit-any
  sb: SupabaseClient<any, any, any>,
  workspace_id: string,
  tipo: string,
): Promise<Record<string, string>> {
  const { data, error } = await sb
    .from('integracoes')
    .select('config, ativo')
    .eq('workspace_id', workspace_id)
    .eq('tipo', tipo)
    .maybeSingle()

  if (error) throw new Error(`Falha ao ler integração ${tipo}: ${error.message}`)
  if (!data || !data.ativo) throw new Error(`Integração "${tipo}" não configurada ou inativa neste workspace`)
  return await decifrarConfig(data.config as Record<string, string>)
}
