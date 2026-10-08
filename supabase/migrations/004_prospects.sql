-- 004 — prospects

CREATE TABLE prospects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campanha_id  UUID NOT NULL REFERENCES campanhas(id),

  -- Identificação
  nome_empresa  TEXT NOT NULL,
  nome_contato  TEXT,
  cargo         TEXT,

  -- Canais de contato
  whatsapp      TEXT,
  email         TEXT,
  linkedin_url  TEXT,
  instagram_handle TEXT,

  -- Dados da empresa
  website       TEXT,
  segmento      TEXT,
  cidade        TEXT,
  estado        TEXT,
  cnpj          TEXT,

  -- Enriquecimento
  score               INT,          -- 0–100 calculado na Camada 2
  score_detalhes      JSONB DEFAULT '{}',  -- breakdown por critério
  dados_enriquecimento JSONB DEFAULT '{}', -- SimilarWeb, CNPJ, Instagram, etc.
  sinais_timing       JSONB DEFAULT '{}',  -- {mudanca_cargo, contratacoes, investimento, etc.}
  enriched_at         TIMESTAMPTZ,

  -- Status no pipeline
  -- 'novo' | 'em_contato' | 'engajado' | 'qualificado' | 'agendado' | 'convertido' | 'descartado' | 'pausado'
  status          TEXT NOT NULL DEFAULT 'novo',
  canal_principal TEXT,  -- canal onde há mais engajamento

  -- Fonte
  fonte    TEXT,  -- 'google_places' | 'apollo' | 'csv' | 'linkedin_scraper' | 'instagram_scraper' | 'cnpj' | 'inbound'
  fonte_id TEXT,  -- ID na fonte original (ex: google_place_id)

  -- Datas chave
  primeiro_contato_em  TIMESTAMPTZ,
  ultima_interacao_em  TIMESTAMPTZ,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prospects_workspace ON prospects(workspace_id);
CREATE INDEX idx_prospects_campanha ON prospects(campanha_id);
CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_prospects_score ON prospects(score DESC);
CREATE INDEX idx_prospects_whatsapp ON prospects(whatsapp);
CREATE INDEX idx_prospects_fonte_id ON prospects(fonte_id);
