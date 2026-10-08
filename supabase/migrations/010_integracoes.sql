-- 010 — integracoes
-- Credenciais e configurações de cada integração por workspace.

CREATE TABLE integracoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Tipo da integração
  tipo TEXT NOT NULL,
  -- Canais de saída:
  --   'whatsapp_evolution' | 'whatsapp_meta' | 'email_instantly' | 'email_mailreach'
  --   'linkedin_expandi'   | 'linkedin_dripify' | 'instagram_meta'
  -- Fontes de dados:
  --   'google_places' | 'apollo' | 'hunter' | 'zerobounce' | 'similarweb'
  --   'crunchbase' | 'phantombuster' | 'apify'
  -- IA:
  --   'anthropic'
  -- CRM:
  --   'morato_crm' | 'webhook_crm'
  -- Calendário:
  --   'calcom'

  config  JSONB NOT NULL DEFAULT '{}',  -- credenciais e configurações (criptografadas)
  ativo   BOOLEAN NOT NULL DEFAULT true,

  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (workspace_id, tipo)
);
