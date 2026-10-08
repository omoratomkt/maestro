-- 007 — fila_acoes
-- Ações propostas pelo agente aguardando aprovação humana (ou execução automática).
--
-- NOTA: fluxo_automatico_id referencia fluxos_automaticos, criada só na 008.
-- A coluna é criada aqui sem FK; a constraint é adicionada ao final da 008.

CREATE TABLE fila_acoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prospect_id  UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  campanha_id  UUID NOT NULL REFERENCES campanhas(id),

  -- A ação proposta
  tipo     TEXT NOT NULL, -- 'primeira_mensagem' | 'followup' | 'resposta' | 'reengajamento' | 'encerrar'
  canal    TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  razao    TEXT NOT NULL,  -- por que o agente quer fazer isso (mostrado no painel)

  -- Status
  -- 'pendente' | 'aprovada' | 'rejeitada' | 'executada' | 'expirada' | 'cancelada'
  status TEXT NOT NULL DEFAULT 'pendente',

  -- Aprovação
  aprovada_por  UUID REFERENCES auth.users(id),
  aprovada_em   TIMESTAMPTZ,
  mensagem_editada TEXT,  -- se o operador editou antes de aprovar

  -- Execução
  executada_em  TIMESTAMPTZ,
  erro_execucao TEXT,

  -- Se veio de um fluxo automático (FK adicionada na 008)
  fluxo_automatico_id UUID,

  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em  TIMESTAMPTZ  -- ação pendente expira após X horas sem ação
);

CREATE INDEX idx_fila_workspace_status ON fila_acoes(workspace_id, status);
CREATE INDEX idx_fila_prospect ON fila_acoes(prospect_id);
CREATE INDEX idx_fila_pendente ON fila_acoes(workspace_id, criado_em DESC)
  WHERE status = 'pendente';
