// Valores aceitos pelo schema (ver supabase/migrations/003_campanhas.sql)

export const FONTES = [
  { value: 'google_places', label: 'Google Places' },
  { value: 'apollo', label: 'Apollo.io' },
  { value: 'linkedin_scraper', label: 'LinkedIn (scraper)' },
  { value: 'instagram_scraper', label: 'Instagram (scraper)' },
  { value: 'cnpj', label: 'Receita Federal / CNPJ' },
  { value: 'csv', label: 'Upload CSV' },
  { value: 'inbound', label: 'Inbound (webhook)' },
] as const

export const CANAIS = [
  { value: 'whatsapp_evolution', label: 'WhatsApp (Evolution API)' },
  { value: 'whatsapp_meta', label: 'WhatsApp (Meta Cloud API)' },
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn DM' },
  { value: 'instagram', label: 'Instagram DM' },
] as const

export const TONS = [
  { value: 'formal', label: 'Formal' },
  { value: 'consultivo', label: 'Consultivo' },
  { value: 'direto', label: 'Direto' },
  { value: 'amigavel', label: 'Amigável' },
] as const

export const STATUS_CAMPANHA = {
  rascunho: 'Rascunho',
  ativa: 'Ativa',
  pausada: 'Pausada',
  encerrada: 'Encerrada',
} as const

export function labelOf(list: readonly { value: string; label: string }[], value: string) {
  return list.find((i) => i.value === value)?.label ?? value
}

export const PIPELINE_STATUS = [
  { value: 'novo', label: 'Novo' },
  { value: 'em_contato', label: 'Em contato' },
  { value: 'engajado', label: 'Engajado' },
  { value: 'qualificado', label: 'Qualificado' },
  { value: 'agendado', label: 'Agendado' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'descartado', label: 'Descartado' },
] as const

/** Todos os status do schema (inclui 'pausado', que só aparece na lista). */
export const ALL_PROSPECT_STATUS = [...PIPELINE_STATUS, { value: 'pausado', label: 'Pausado' }] as const

export const CANAIS_INTERACAO = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
] as const
