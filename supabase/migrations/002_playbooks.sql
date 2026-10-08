-- 002 — playbooks

CREATE TABLE playbooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  descricao   TEXT,
  icone       TEXT, -- nome do ícone Lucide
  -- Defaults pre-configurados
  fontes_padrao             TEXT[] DEFAULT '{}',     -- ['google_places', 'apollo', ...]
  canais_padrao             TEXT[] DEFAULT '{}',     -- ['whatsapp_evolution', 'email', ...]
  icp_padrao                JSONB  DEFAULT '{}',
  persona_padrao            JSONB  DEFAULT '{}',
  criterios_qualificacao_padrao JSONB DEFAULT '[]',
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
