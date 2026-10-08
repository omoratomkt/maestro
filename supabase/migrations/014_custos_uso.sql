-- 014 — custos_uso: registro de custo de IA por chamada (alimenta "custo por lead qualificado" nas Métricas).
-- Escrita só pelas Edge Functions (service_role). Leitura pelos membros do workspace.

CREATE TABLE custos_uso (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prospect_id  UUID REFERENCES prospects(id) ON DELETE SET NULL,
  origem       TEXT NOT NULL,   -- 'agent' | 'triage' | 'qualify' | 'briefing' | 'enrich'
  modelo       TEXT NOT NULL,
  tokens_in    INT NOT NULL DEFAULT 0,
  tokens_out   INT NOT NULL DEFAULT 0,
  custo_usd    NUMERIC(10,6) NOT NULL DEFAULT 0,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custos_workspace_data ON custos_uso(workspace_id, criado_em DESC);
CREATE INDEX idx_custos_prospect ON custos_uso(prospect_id);

ALTER TABLE custos_uso ENABLE ROW LEVEL SECURITY;
CREATE POLICY custos_select ON custos_uso FOR SELECT TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

-- Métricas: acrescenta custo total e custo por lead qualificado.
CREATE OR REPLACE FUNCTION metricas_resumo(dias INT DEFAULT 30)
RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH janela AS (SELECT now() - make_interval(days => dias) AS desde),
  i AS (SELECT pi.* FROM prospect_interacoes pi, janela WHERE pi.enviado_em >= janela.desde),
  canal AS (
    SELECT canal,
      count(DISTINCT prospect_id) FILTER (WHERE direcao = 'out') AS contatados,
      count(DISTINCT prospect_id) FILTER (WHERE direcao = 'in')  AS responderam
    FROM i GROUP BY canal
  ),
  custo AS (SELECT COALESCE(sum(c.custo_usd), 0) AS total FROM custos_uso c, janela WHERE c.criado_em >= janela.desde),
  qual AS (SELECT count(*) AS n FROM leads_qualificados l, janela WHERE l.qualificado_em >= janela.desde)
  SELECT jsonb_build_object(
    'prospects_processados', (SELECT count(*) FROM prospects p, janela WHERE p.criado_em >= janela.desde),
    'mensagens_enviadas',    (SELECT count(*) FROM i WHERE direcao = 'out'),
    'respostas',             (SELECT count(*) FROM i WHERE direcao = 'in'),
    'qualificados',          (SELECT n FROM qual),
    'horas_ate_qualificar',  (SELECT avg(extract(epoch FROM (l.qualificado_em - p.criado_em)) / 3600)
                              FROM leads_qualificados l JOIN prospects p ON p.id = l.prospect_id, janela
                              WHERE l.qualificado_em >= janela.desde),
    'custo_total_usd',       (SELECT total FROM custo),
    'custo_por_lead_usd',    (SELECT CASE WHEN (SELECT n FROM qual) > 0 THEN (SELECT total FROM custo) / (SELECT n FROM qual) END),
    'por_canal', COALESCE((SELECT jsonb_agg(jsonb_build_object('canal', canal, 'contatados', contatados, 'responderam', responderam)) FROM canal), '[]'::jsonb),
    'funil',     COALESCE((SELECT jsonb_agg(jsonb_build_object('status', status, 'total', n)) FROM (SELECT status, count(*) AS n FROM prospects GROUP BY status) s), '[]'::jsonb)
  )
$$;
