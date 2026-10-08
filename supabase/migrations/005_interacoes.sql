-- 005 — prospect_interacoes

CREATE TABLE prospect_interacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,

  canal    TEXT NOT NULL,  -- 'whatsapp' | 'email' | 'linkedin' | 'instagram'
  direcao  TEXT NOT NULL CHECK (direcao IN ('in', 'out')),
  conteudo TEXT NOT NULL,
  tipo     TEXT NOT NULL DEFAULT 'text' CHECK (tipo IN ('text', 'audio', 'image', 'document', 'template')),

  -- Status do envio (para mensagens 'out')
  status   TEXT DEFAULT 'enviado', -- 'enviado' | 'entregue' | 'lido' | 'respondido' | 'erro'

  -- Metadados do canal
  metadata JSONB DEFAULT '{}',  -- {message_id, thread_id, template_name, etc.}

  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interacoes_prospect ON prospect_interacoes(prospect_id);
CREATE INDEX idx_interacoes_enviado_em ON prospect_interacoes(enviado_em DESC);
CREATE INDEX idx_interacoes_canal ON prospect_interacoes(canal);
