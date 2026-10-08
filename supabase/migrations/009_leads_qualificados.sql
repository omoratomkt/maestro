-- 009 — leads_qualificados
-- Prospects que completaram qualificação — aguardam reunião.

CREATE TABLE leads_qualificados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prospect_id  UUID NOT NULL REFERENCES prospects(id) UNIQUE,

  -- Briefing gerado pelo agente
  briefing JSONB NOT NULL DEFAULT '{}',
  -- {
  --   dor_principal: text,
  --   budget: text,
  --   timeline: text,
  --   e_decisor: boolean,
  --   objecoes: text[],
  --   sentimento: 'positivo' | 'neutro' | 'cético',
  --   resumo_conversa: text,
  --   pontos_chave: text[]
  -- }

  score_temperatura INT, -- 1–10

  proximo_passo TEXT,

  -- Reunião
  -- 'pendente' | 'agendada' | 'realizada' | 'no_show' | 'cancelada'
  status_reuniao   TEXT DEFAULT 'pendente',
  reuniao_em       TIMESTAMPTZ,
  calcom_booking_id TEXT,

  -- Integração CRM
  crm_lead_id           TEXT,   -- ID no morato-crm ou CRM externo
  crm_webhook_enviado   BOOLEAN DEFAULT false,
  crm_webhook_enviado_em TIMESTAMPTZ,

  qualificado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_workspace ON leads_qualificados(workspace_id);
CREATE INDEX idx_leads_status_reuniao ON leads_qualificados(status_reuniao);
