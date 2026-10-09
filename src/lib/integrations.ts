// Catálogo de integrações (tipos de supabase/migrations/010_integracoes.sql) e os campos de credencial de cada uma.

export interface IntegrationField {
  key: string
  label: string
  secret?: boolean
  /** Campos opcionais não bloqueiam o salvamento. */
  optional?: boolean
  placeholder?: string
  hint?: string
  /** Campo de texto longo (ex.: JSON). */
  multiline?: boolean
}

export interface IntegrationDef {
  tipo: string
  label: string
  group: 'Canais de saída' | 'Fontes de dados' | 'IA' | 'CRM' | 'Calendário'
  fields: IntegrationField[]
  /** Edge Function que recebe as respostas deste canal (precisa do campo webhook_secret). */
  webhook?: string
  /** O provedor assina a chamada (ex.: Cal.com); a URL não leva o token. */
  webhookSigned?: boolean
  note?: string
}

const apiKey: IntegrationField = { key: 'api_key', label: 'API key', secret: true }
const webhookSecret: IntegrationField = {
  key: 'webhook_secret',
  label: 'Segredo do webhook',
  secret: true,
  hint: 'Autentica as chamadas que o provedor faz ao Maestro. Use "Gerar" e cole a URL abaixo no provedor.',
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    tipo: 'whatsapp_evolution',
    label: 'WhatsApp (Evolution API)',
    group: 'Canais de saída',
    webhook: 'webhook-whatsapp',
    note: 'Eventos a assinar na Evolution: MESSAGES_UPSERT e MESSAGES_UPDATE.',
    fields: [
      { key: 'base_url', label: 'URL da instância', placeholder: 'https://evolution.exemplo.com' },
      apiKey,
      { key: 'instance', label: 'Nome da instância' },
      webhookSecret,
    ],
  },
  {
    tipo: 'whatsapp_meta',
    label: 'WhatsApp (Meta Cloud API)',
    group: 'Canais de saída',
    webhook: 'webhook-whatsapp',
    note: 'Fora da janela de 24h a Meta exige template aprovado; o Maestro envia texto simples.',
    fields: [
      { key: 'access_token', label: 'Access token', secret: true },
      { key: 'phone_number_id', label: 'Phone number ID' },
      { key: 'verify_token', label: 'Verify token do webhook', secret: true },
      webhookSecret,
      { key: 'app_secret', label: 'App secret (valida a assinatura)', secret: true, optional: true },
    ],
  },
  {
    tipo: 'email_instantly',
    label: 'Email (Instantly.ai)',
    group: 'Canais de saída',
    webhook: 'webhook-email',
    note: 'O primeiro email entra como lead na campanha do Instantly, cujo corpo deve ser {{personalization}}. Respostas usam /emails/reply. Cadastre o webhook do evento reply_received.',
    fields: [
      apiKey,
      { key: 'campaign_id', label: 'ID da campanha no Instantly', hint: 'Campanha com o corpo do email = {{personalization}}.' },
      { key: 'eaccount', label: 'Conta de envio (email)', optional: true },
      webhookSecret,
    ],
  },
  { tipo: 'email_mailreach', label: 'Email (Mailreach)', group: 'Canais de saída', fields: [apiKey], note: 'Ainda sem envio implementado.' },
  {
    tipo: 'linkedin_expandi',
    label: 'LinkedIn (Expandi)',
    group: 'Canais de saída',
    webhook: 'webhook-linkedin',
    note: 'Só recebe respostas por webhook. O envio avulso por API ainda não existe nas ferramentas de LinkedIn.',
    fields: [{ ...apiKey, optional: true }, webhookSecret],
  },
  {
    tipo: 'linkedin_dripify',
    label: 'LinkedIn (Dripify)',
    group: 'Canais de saída',
    webhook: 'webhook-linkedin',
    note: 'A Open API do Dripify ainda não envia mensagens. Só recebe respostas por webhook.',
    fields: [{ ...apiKey, optional: true }, webhookSecret],
  },
  {
    tipo: 'instagram_meta',
    label: 'Instagram DM (Meta API)',
    group: 'Canais de saída',
    webhook: 'webhook-instagram',
    note: 'A Meta só permite responder a quem já escreveu, dentro de 24 h. O agente só usa este canal nesses casos.',
    fields: [
      { key: 'access_token', label: 'Access token', secret: true },
      { key: 'instagram_account_id', label: 'Instagram account ID' },
      { key: 'verify_token', label: 'Verify token do webhook', secret: true },
      webhookSecret,
    ],
  },
  { tipo: 'google_places', label: 'Google Places', group: 'Fontes de dados', fields: [apiKey] },
  { tipo: 'apollo', label: 'Apollo.io', group: 'Fontes de dados', fields: [apiKey], note: 'A busca é grátis; cada pessoa aproveitada gasta 1 crédito do Apollo (people/match), até 15 por rodada.' },
  { tipo: 'hunter', label: 'Hunter.io', group: 'Fontes de dados', fields: [apiKey] },
  { tipo: 'zerobounce', label: 'ZeroBounce', group: 'Fontes de dados', fields: [apiKey] },
  { tipo: 'similarweb', label: 'SimilarWeb', group: 'Fontes de dados', fields: [apiKey], note: 'Ainda não usado pelo enriquecimento.' },
  { tipo: 'crunchbase', label: 'Crunchbase', group: 'Fontes de dados', fields: [apiKey], note: 'Ainda não usado pelo enriquecimento.' },
  { tipo: 'phantombuster', label: 'Phantombuster', group: 'Fontes de dados', fields: [apiKey], note: 'Não usado: as fontes de LinkedIn e Instagram rodam pelo Apify.' },
  {
    tipo: 'apify',
    label: 'Apify (Instagram e LinkedIn)',
    group: 'Fontes de dados',
    note: 'Instagram usa por padrão o ator apify/instagram-scraper. LinkedIn exige ator e entrada próprios (o scraping do LinkedIn viola os Termos de Uso da plataforma). Use {{query}} e {{limit}} na entrada JSON.',
    fields: [
      { key: 'api_token', label: 'API token', secret: true },
      { key: 'actor_instagram', label: 'Ator do Instagram (opcional)', optional: true, placeholder: 'apify/instagram-scraper' },
      { key: 'input_instagram', label: 'Entrada JSON do Instagram (opcional)', optional: true, multiline: true, placeholder: '{"search":"{{query}}","searchType":"user","searchLimit":{{limit}},"resultsType":"details"}' },
      { key: 'actor_linkedin', label: 'Ator do LinkedIn', optional: true, placeholder: 'dono/nome-do-ator' },
      { key: 'input_linkedin', label: 'Entrada JSON do LinkedIn', optional: true, multiline: true, placeholder: '{"searchQuery":"{{query}}","maxItems":{{limit}}}' },
    ],
  },
  {
    tipo: 'inbound_webhook',
    label: 'Leads inbound (formulários, site, Zapier)',
    group: 'Fontes de dados',
    webhook: 'webhook-lead',
    note: 'Envie um POST JSON (nome_empresa, nome_contato, email, whatsapp, mensagem...) para a URL abaixo. A campanha é a única ativa com a fonte "inbound", ou a que você indicar.',
    fields: [{ key: 'campaign_id', label: 'ID da campanha de destino', optional: true }, webhookSecret],
  },
  { tipo: 'anthropic', label: 'Anthropic (Claude)', group: 'IA', fields: [apiKey], note: 'Usada pelo agente (Sonnet), triagem e qualificação (Haiku).' },
  {
    tipo: 'morato_crm',
    label: 'morato-crm',
    group: 'CRM',
    fields: [{ key: 'webhook_url', label: 'URL do webhook' }, { key: 'secret', label: 'Segredo do webhook', secret: true, optional: true }],
    note: 'Recebe um POST quando um lead é qualificado (cabeçalho X-Maestro-Secret).',
  },
  {
    tipo: 'webhook_crm',
    label: 'CRM via webhook',
    group: 'CRM',
    fields: [{ key: 'webhook_url', label: 'URL do webhook' }, { key: 'secret', label: 'Segredo do webhook', secret: true, optional: true }],
    note: 'Recebe um POST quando um lead é qualificado (cabeçalho X-Maestro-Secret).',
  },
  {
    tipo: 'calcom',
    label: 'Cal.com',
    group: 'Calendário',
    webhook: 'webhook-calcom',
    webhookSigned: true,
    note: 'O agente envia o link de agendamento quando o lead é qualificado. O webhook do Cal.com (BOOKING_CREATED, RESCHEDULED, CANCELLED) atualiza o lead e o pipeline. Informe o mesmo segredo no campo Secret do webhook.',
    fields: [
      { key: 'booking_url', label: 'Link de agendamento', placeholder: 'https://cal.com/seu-usuario/30min' },
      webhookSecret,
    ],
  },
]

export const INTEGRATION_GROUPS = ['Canais de saída', 'Fontes de dados', 'IA', 'CRM', 'Calendário'] as const

/** Mostra só o final de um segredo (nunca o valor completo). */
export function maskSecret(value: unknown): string {
  const s = typeof value === 'string' ? value : ''
  return s ? `••••${s.slice(-4)}` : ''
}

export function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
