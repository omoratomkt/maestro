-- 003 — campanhas

CREATE TABLE campanhas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  playbook_id  UUID REFERENCES playbooks(id),  -- null = campanha personalizada
  nome         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'rascunho', -- 'rascunho' | 'ativa' | 'pausada' | 'encerrada'

  -- ICP
  segmento              TEXT,
  cargos_alvo           TEXT[] DEFAULT '{}',
  regioes               TEXT[] DEFAULT '{}',
  score_minimo          INT NOT NULL DEFAULT 60,
  criterios_exclusao    JSONB DEFAULT '[]',
  volume_semanal        INT DEFAULT 50,

  -- Persona do agente
  persona_nome          TEXT,
  persona_tom           TEXT,   -- 'formal' | 'consultivo' | 'direto' | 'amigavel'
  persona_produto       TEXT,
  persona_argumentos    TEXT[] DEFAULT '{}',
  persona_objecoes      JSONB DEFAULT '[]',  -- [{objecao, resposta}]

  -- Qualificação
  criterios_qualificacao JSONB DEFAULT '[]', -- [{campo, pergunta, obrigatorio}]

  -- Fontes e canais ativos
  fontes   TEXT[] DEFAULT '{}', -- ['google_places', 'apollo', 'csv', 'linkedin_scraper', 'instagram_scraper', 'cnpj', 'inbound']
  canais   TEXT[] DEFAULT '{}', -- ['whatsapp_evolution', 'whatsapp_meta', 'email', 'linkedin', 'instagram']

  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campanhas_workspace ON campanhas(workspace_id);
CREATE INDEX idx_campanhas_status ON campanhas(status);
