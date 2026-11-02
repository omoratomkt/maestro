-- 024: governança dos agentes de IA (aba "Agentes")
--  1) plataforma_config: interruptor geral da IA (`ia_pausada`). Só o super_admin lê e altera; as Edge Functions leem antes de cada chamada ao modelo.
--  2) ia_chamadas_log: uma linha por chamada ao modelo (papel, modelo, entrada e saída resumidas e MASCARADAS, tokens, custo, tempo, resultado).
--  3) agente_prompts + agente_prompt_versoes: instruções adicionais do agente de conversa, por workspace, com histórico (autor e data) gravado por gatilho.
-- Escrita nas tabelas de log e de versões só pelas Edge Functions (service_role) e pelo gatilho; nenhuma política de escrita para usuários.

-- ───────────────────────────── 1) interruptor geral da IA
CREATE TABLE plataforma_config (
  chave          TEXT PRIMARY KEY,
  valor          JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID
);
ALTER TABLE plataforma_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY plataforma_config_super_admin ON plataforma_config FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

INSERT INTO plataforma_config (chave, valor) VALUES ('ia_pausada', '{"pausada": false}'::jsonb);

-- quem mexeu e quando fica registrado na própria linha
CREATE OR REPLACE FUNCTION _trg_plataforma_config() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.atualizado_em := now();
  NEW.atualizado_por := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER plataforma_config_carimbo BEFORE INSERT OR UPDATE ON plataforma_config
  FOR EACH ROW EXECUTE FUNCTION _trg_plataforma_config();

-- ───────────────────────────── 2) registro por chamada de IA
CREATE TABLE ia_chamadas_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prospect_id   UUID,
  papel         TEXT NOT NULL,  -- 'agent' | 'triage' | 'qualify' | 'briefing' | 'enrich'
  modelo        TEXT,
  entrada       TEXT,           -- resumo mascarado e cortado do que foi enviado ao modelo
  saida         TEXT,           -- resumo mascarado e cortado do que o modelo devolveu
  tokens_in     INTEGER,
  tokens_out    INTEGER,
  custo_usd     NUMERIC(10,6),
  tempo_ms      INTEGER,
  resultado     TEXT NOT NULL,  -- 'ok' | 'erro' | 'bloqueado' (teto) | 'pausada' (interruptor geral)
  erro          TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ia_log_ws_data ON ia_chamadas_log (workspace_id, criado_em DESC);
CREATE INDEX idx_ia_log_ws_papel ON ia_chamadas_log (workspace_id, papel, criado_em DESC);
ALTER TABLE ia_chamadas_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ia_log_select ON ia_chamadas_log FOR SELECT TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

-- ───────────────────────────── 3) instruções do agente e histórico de versões
CREATE TABLE agente_prompts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  papel          TEXT NOT NULL CHECK (papel = 'agente'),  -- só o agente de conversa é editável
  instrucoes     TEXT NOT NULL CHECK (char_length(instrucoes) <= 4000),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID,
  UNIQUE (workspace_id, papel)
);
ALTER TABLE agente_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY agente_prompts_select ON agente_prompts FOR SELECT TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());
CREATE POLICY agente_prompts_escrita ON agente_prompts FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE TABLE agente_prompt_versoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  papel        TEXT NOT NULL,
  instrucoes   TEXT NOT NULL,
  autor_id     UUID,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prompt_versoes ON agente_prompt_versoes (workspace_id, papel, criado_em DESC);
ALTER TABLE agente_prompt_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY agente_prompt_versoes_select ON agente_prompt_versoes FOR SELECT TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());
-- sem política de escrita: só o gatilho grava

CREATE OR REPLACE FUNCTION _trg_agente_prompt_versao() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.instrucoes IS DISTINCT FROM OLD.instrucoes THEN
    INSERT INTO agente_prompt_versoes (workspace_id, papel, instrucoes, autor_id)
    VALUES (NEW.workspace_id, NEW.papel, NEW.instrucoes, auth.uid());
  END IF;
  NEW.atualizado_em := now();
  NEW.atualizado_por := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER agente_prompts_versao BEFORE INSERT OR UPDATE OF instrucoes ON agente_prompts
  FOR EACH ROW EXECUTE FUNCTION _trg_agente_prompt_versao();

-- ───────────────────────────── retenção
-- Entrada e saída de IA têm trecho de conversa (dado pessoal): ficam 90 dias.
SELECT cron.schedule('limpar-log-de-ia', '45 3 * * *', $$ DELETE FROM ia_chamadas_log WHERE criado_em < now() - interval '90 days'; $$);
