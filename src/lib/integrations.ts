// Catálogo de integrações (tipos de supabase/migrations/010_integracoes.sql) e os campos de credencial de cada uma.

export interface IntegrationField {
  key: string
  label: string
  secret?: boolean
  placeholder?: string
}

export interface IntegrationDef {
  tipo: string
  label: string
  group: 'Canais de saída' | 'Fontes de dados' | 'IA' | 'CRM' | 'Calendário'
  fields: IntegrationField[]
}

const apiKey: IntegrationField = { key: 'api_key', label: 'API key', secret: true }

export const INTEGRATIONS: IntegrationDef[] = [
  {
    tipo: 'whatsapp_evolution',
    label: 'WhatsApp (Evolution API)',
    group: 'Canais de saída',
    fields: [
      { key: 'base_url', label: 'URL da instância', placeholder: 'https://evolution.exemplo.com' },
      apiKey,
      { key: 'instance', label: 'Nome da instância' },
    ],
  },
  {
    tipo: 'whatsapp_meta',
    label: 'WhatsApp (Meta Cloud API)',
    group: 'Canais de saída',
    fields: [
      { key: 'access_token', label: 'Access token', secret: true },
      { key: 'phone_number_id', label: 'Phone number ID' },
      { key: 'verify_token', label: 'Verify token do webhook', secret: true },
    ],
  },
  { tipo: 'email_instantly', label: 'Email (Instantly.ai)', group: 'Canais de saída', fields: [apiKey] },
  { tipo: 'email_mailreach', label: 'Email (Mailreach)', group: 'Canais de saída', fields: [apiKey] },
  { tipo: 'linkedin_expandi', label: 'LinkedIn (Expandi)', group: 'Canais de saída', fields: [apiKey] },
  { tipo: 'linkedin_dripify', label: 'LinkedIn (Dripify)', group: 'Canais de saída', fields: [apiKey] },
  {
    tipo: 'instagram_meta',
    label: 'Instagram DM (Meta API)',
    group: 'Canais de saída',
    fields: [
      { key: 'access_token', label: 'Access token', secret: true },
      { key: 'instagram_account_id', label: 'Instagram account ID' },
    ],
  },
  { tipo: 'google_places', label: 'Google Places', group: 'Fontes de dados', fields: [apiKey] },
  { tipo: 'apollo', label: 'Apollo.io', group: 'Fontes de dados', fields: [apiKey] },
  { tipo: 'hunter', label: 'Hunter.io', group: 'Fontes de dados', fields: [apiKey] },
  { tipo: 'zerobounce', label: 'ZeroBounce', group: 'Fontes de dados', fields: [apiKey] },
  { tipo: 'similarweb', label: 'SimilarWeb', group: 'Fontes de dados', fields: [apiKey] },
  { tipo: 'crunchbase', label: 'Crunchbase', group: 'Fontes de dados', fields: [apiKey] },
  { tipo: 'phantombuster', label: 'Phantombuster', group: 'Fontes de dados', fields: [apiKey] },
  { tipo: 'apify', label: 'Apify', group: 'Fontes de dados', fields: [{ key: 'api_token', label: 'API token', secret: true }] },
  { tipo: 'anthropic', label: 'Anthropic (Claude)', group: 'IA', fields: [apiKey] },
  {
    tipo: 'morato_crm',
    label: 'morato-crm',
    group: 'CRM',
    fields: [
      { key: 'webhook_url', label: 'URL do webhook' },
      { key: 'secret', label: 'Segredo do webhook', secret: true },
    ],
  },
  {
    tipo: 'webhook_crm',
    label: 'CRM via webhook',
    group: 'CRM',
    fields: [
      { key: 'webhook_url', label: 'URL do webhook' },
      { key: 'secret', label: 'Segredo do webhook', secret: true },
    ],
  },
  {
    tipo: 'calcom',
    label: 'Cal.com',
    group: 'Calendário',
    fields: [apiKey, { key: 'event_type_id', label: 'Event type ID' }],
  },
]

export const INTEGRATION_GROUPS = ['Canais de saída', 'Fontes de dados', 'IA', 'CRM', 'Calendário'] as const

/** Mostra só o final de um segredo (nunca o valor completo). */
export function maskSecret(value: unknown): string {
  const s = typeof value === 'string' ? value : ''
  return s ? `••••${s.slice(-4)}` : ''
}
