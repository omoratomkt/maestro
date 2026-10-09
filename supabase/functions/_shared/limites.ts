// Freios de segurança: limite diário de envios por canal e teto diário de gasto com IA, por workspace.
import type { SB } from './util.ts'

/** Padrões conservadores (WhatsApp não-oficial pode ser banido por volume). Ajustáveis por integração em `limite_diario`. */
export const LIMITE_PADRAO_DIARIO: Record<string, number> = { whatsapp: 100, email: 150, instagram: 100, linkedin: 50 }
export const LIMITE_PADRAO_IA_USD = 10

const PROVEDORES: Record<string, string[]> = {
  whatsapp: ['whatsapp_evolution', 'whatsapp_meta'],
  email: ['email_instantly'],
  instagram: ['instagram_meta'],
  linkedin: ['linkedin_expandi', 'linkedin_dripify'],
}

/** Meia-noite de Brasília (UTC−3, sem horário de verão) do dia de `now`, como instante UTC. */
export function inicioDoDiaBrt(now = new Date()): Date {
  const OFFSET = 3 * 3600e3
  const b = new Date(now.getTime() - OFFSET)
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) + OFFSET)
}

/** Menor `limite_diario` configurado nas integrações ativas do canal; sem configuração, o padrão. */
export async function limiteDiario(sb: SB, workspace_id: string, canal: string): Promise<number> {
  const { data } = await sb.from('integracoes').select('config').eq('workspace_id', workspace_id).eq('ativo', true).in('tipo', PROVEDORES[canal] ?? [])
  const configurados = (data ?? []).map((r: any) => Number(r.config?.limite_diario)).filter((n: number) => Number.isFinite(n) && n > 0)
  return configurados.length ? Math.min(...configurados) : (LIMITE_PADRAO_DIARIO[canal] ?? 100)
}

/** Mensagens enviadas hoje (desde a meia-noite de Brasília) no canal, somando todas as campanhas do workspace. */
export async function enviadosHoje(sb: SB, workspace_id: string, canal: string): Promise<number> {
  const { count } = await sb
    .from('prospect_interacoes')
    .select('id, prospects!inner(workspace_id)', { count: 'exact', head: true })
    .eq('prospects.workspace_id', workspace_id)
    .eq('canal', canal)
    .eq('direcao', 'out')
    .gte('enviado_em', inicioDoDiaBrt().toISOString())
  return count ?? 0
}

/** Gasto com IA de hoje (US$) do workspace. */
export async function gastoIaHoje(sb: SB, workspace_id: string): Promise<number> {
  const { data } = await sb.from('custos_uso').select('custo_usd').eq('workspace_id', workspace_id).gte('criado_em', inicioDoDiaBrt().toISOString()).limit(10000)
  return (data ?? []).reduce((s: number, r: any) => s + Number(r.custo_usd ?? 0), 0)
}
