-- 018 — metricas_resumo passa a aceitar o workspace (p_ws). Sem ele, super_admin veria a soma de todos os clientes.
DROP FUNCTION IF EXISTS metricas_resumo(INT);

CREATE OR REPLACE FUNCTION metricas_resumo(dias INT DEFAULT 30, p_ws UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH janela AS (SELECT now() - make_interval(days => dias) AS desde),
  pr AS (SELECT * FROM prospects WHERE p_ws IS NULL OR workspace_id = p_ws),
  i AS (
    SELECT pi.* FROM prospect_interacoes pi, janela
    WHERE pi.enviado_em >= janela.desde AND pi.prospect_id IN (SELECT id FROM pr)
  ),
  canal AS (
    SELECT canal,
      count(DISTINCT prospect_id) FILTER (WHERE direcao = 'out') AS contatados,
      count(DISTINCT prospect_id) FILTER (WHERE direcao = 'in')  AS responderam
    FROM i GROUP BY canal
  ),
  custo AS (SELECT COALESCE(sum(c.custo_usd), 0) AS total FROM custos_uso c, janela WHERE c.criado_em >= janela.desde AND (p_ws IS NULL OR c.workspace_id = p_ws)),
  leads AS (SELECT l.* FROM leads_qualificados l, janela WHERE l.qualificado_em >= janela.desde AND (p_ws IS NULL OR l.workspace_id = p_ws)),
  qual AS (SELECT count(*) AS n FROM leads)
  SELECT jsonb_build_object(
    'prospects_processados', (SELECT count(*) FROM pr, janela WHERE pr.criado_em >= janela.desde),
    'mensagens_enviadas',    (SELECT count(*) FROM i WHERE direcao = 'out'),
    'respostas',             (SELECT count(*) FROM i WHERE direcao = 'in'),
    'qualificados',          (SELECT n FROM qual),
    'horas_ate_qualificar',  (SELECT avg(extract(epoch FROM (l.qualificado_em - p.criado_em)) / 3600) FROM leads l JOIN pr p ON p.id = l.prospect_id),
    'custo_total_usd',       (SELECT total FROM custo),
    'custo_por_lead_usd',    (SELECT CASE WHEN (SELECT n FROM qual) > 0 THEN (SELECT total FROM custo) / (SELECT n FROM qual) END),
    'por_canal', COALESCE((SELECT jsonb_agg(jsonb_build_object('canal', canal, 'contatados', contatados, 'responderam', responderam)) FROM canal), '[]'::jsonb),
    'funil',     COALESCE((SELECT jsonb_agg(jsonb_build_object('status', status, 'total', n)) FROM (SELECT status, count(*) AS n FROM pr GROUP BY status) s), '[]'::jsonb)
  )
$$;
