-- 016 — supressoes (lista de "não contatar") + ciclo_log (histórico das rodadas do agent-loop).

-- Quem pediu para não ser contatado (ou foi bloqueado manualmente). Vale para o workspace inteiro, em todas as campanhas.
CREATE TABLE supressoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('email', 'whatsapp', 'linkedin', 'instagram', 'dominio')),
  valor        TEXT NOT NULL,   -- normalizado: email/domínio/@ em minúsculas; whatsapp só dígitos com DDI; linkedin = slug do perfil
  motivo       TEXT,
  origem       TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'resposta' | 'importacao'
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, tipo, valor)
);
CREATE INDEX idx_supressoes_workspace ON supressoes(workspace_id);

ALTER TABLE supressoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY supressoes_ws ON supressoes FOR ALL TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin())
  WITH CHECK (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

-- Uma linha por rodada do agent-loop (visibilidade operacional; escrita só pela Edge Function).
CREATE TABLE ciclo_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  followup     BOOLEAN NOT NULL DEFAULT false,
  duracao_ms   INT NOT NULL DEFAULT 0,
  resumo       JSONB NOT NULL DEFAULT '{}',
  erros        INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_ciclo_log_data ON ciclo_log(executado_em DESC);

ALTER TABLE ciclo_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ciclo_log_admin ON ciclo_log FOR SELECT TO authenticated USING (is_super_admin());
