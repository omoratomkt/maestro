-- 008 — fluxos_automaticos
-- Padrões que o operador promoveu para execução automática.

CREATE TABLE fluxos_automaticos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campanha_id  UUID REFERENCES campanhas(id),  -- null = vale para todo o workspace

  nome      TEXT NOT NULL,
  descricao TEXT,

  -- Condição de disparo
  condicao JSONB NOT NULL,
  -- Exemplo: {"evento": "email_aberto_sem_resposta", "canal": "email", "delay_horas": 24}

  -- Ação a executar
  tipo_acao         TEXT NOT NULL,
  canal_acao        TEXT NOT NULL,
  template_mensagem TEXT NOT NULL,
  delay_horas       INT DEFAULT 0,

  -- Estado
  ativo BOOLEAN NOT NULL DEFAULT true,

  -- Performance histórica
  total_execucoes INT DEFAULT 0,
  total_respostas INT DEFAULT 0,
  taxa_sucesso    NUMERIC(5,2),

  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fluxos_workspace ON fluxos_automaticos(workspace_id)
  WHERE ativo = true;

-- FK pendente da 007 (fila_acoes.fluxo_automatico_id)
ALTER TABLE fila_acoes
  ADD CONSTRAINT fila_acoes_fluxo_automatico_id_fkey
  FOREIGN KEY (fluxo_automatico_id) REFERENCES fluxos_automaticos(id);
