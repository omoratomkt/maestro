-- 006 — prospect_estado
-- Estado do agente por prospect — o que está monitorando e quando vai agir.

CREATE TABLE prospect_estado (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE UNIQUE,

  -- O que o agente está aguardando
  aguardando TEXT, -- 'resposta' | 'tempo' | 'sinal' | 'aprovacao' | 'nenhum'

  -- Quando o agente deve checar novamente
  proxima_acao_em TIMESTAMPTZ,

  -- Contexto comprimido da conversa para o agente
  contexto_resumo TEXT,

  -- Controle de tentativas por canal
  tentativas_whatsapp  INT DEFAULT 0,
  tentativas_email     INT DEFAULT 0,
  tentativas_linkedin  INT DEFAULT 0,
  tentativas_instagram INT DEFAULT 0,

  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_estado_proxima_acao ON prospect_estado(proxima_acao_em)
  WHERE proxima_acao_em IS NOT NULL;
