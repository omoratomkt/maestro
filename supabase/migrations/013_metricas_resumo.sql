-- 013 — metricas_resumo(dias): agregados para a tela de Métricas.
-- SECURITY INVOKER: o RLS do usuário que chama continua valendo (cada workspace vê só o seu).

CREATE OR REPLACE FUNCTION metricas_resumo(dias INT DEFAULT 30)
RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH janela AS (SELECT now() - make_interval(days => dias) AS desde),
  i AS (SELECT pi.* FROM prospect_interacoes pi, janela WHERE pi.enviado_em >= janela.desde),
  canal AS (
    SELECT canal,
      count(DISTINCT prospect_id) FILTER (WHERE direcao = 'out') AS contatados,
      count(DISTINCT prospect_id) FILTER (WHERE direcao = 'in')  AS responderam
    FROM i GROUP BY canal
  )
  SELECT jsonb_build_object(
    'prospects_processados', (SELECT count(*) FROM prospects p, janela WHERE p.criado_em >= janela.desde),
    'mensagens_enviadas',    (SELECT count(*) FROM i WHERE direcao = 'out'),
    'respostas',             (SELECT count(*) FROM i WHERE direcao = 'in'),
    'qualificados',          (SELECT count(*) FROM leads_qualificados l, janela WHERE l.qualificado_em >= janela.desde),
    'horas_ate_qualificar',  (SELECT avg(extract(epoch FROM (l.qualificado_em - p.criado_em)) / 3600)
                              FROM leads_qualificados l JOIN prospects p ON p.id = l.prospect_id, janela
                              WHERE l.qualificado_em >= janela.desde),
    'por_canal', COALESCE((SELECT jsonb_agg(jsonb_build_object('canal', canal, 'contatados', contatados, 'responderam', responderam)) FROM canal), '[]'::jsonb),
    'funil',     COALESCE((SELECT jsonb_agg(jsonb_build_object('status', status, 'total', n)) FROM (SELECT status, count(*) AS n FROM prospects GROUP BY status) s), '[]'::jsonb)
  )
$$;
