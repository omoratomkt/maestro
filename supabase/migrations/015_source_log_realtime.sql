-- 015 — source_log (histórico de buscas por fonte) + Realtime para a fila, as mensagens e o pipeline.

-- Evita repetir a mesma consulta e permite rotacionar regiões/páginas entre as rodadas.
CREATE TABLE source_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campanha_id  UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  fonte        TEXT NOT NULL,
  consulta     TEXT NOT NULL,
  novos        INT NOT NULL DEFAULT 0,
  total        INT NOT NULL DEFAULT 0,
  erro         TEXT,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_log_consulta ON source_log(campanha_id, fonte, consulta, executado_em DESC);
CREATE INDEX idx_source_log_campanha_data ON source_log(campanha_id, executado_em DESC);

ALTER TABLE source_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY source_log_select ON source_log FOR SELECT TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

-- Realtime (o RLS continua valendo: cada usuário só recebe eventos do próprio workspace).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fila_acoes', 'prospect_interacoes', 'prospects'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
