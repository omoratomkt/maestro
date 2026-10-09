-- Complemento do demo_seed.sql: sinais de timing e 14 dias de histórico de métricas para a campanha [DEMO].
-- Idempotente. O demo_cleanup.sql apaga junto (cascata pela campanha/prospects de demonstração).
DO $$
DECLARE ws UUID; camp UUID; i INT; total INT; env INT; resp INT; qual INT; ids UUID[];
BEGIN
  SELECT id INTO ws FROM workspaces WHERE slug = 'morato';
  SELECT id INTO camp FROM campanhas WHERE workspace_id = ws AND nome LIKE '[DEMO]%' LIMIT 1;
  IF camp IS NULL THEN RAISE NOTICE 'Rode demo_seed.sql antes.'; RETURN; END IF;

  SELECT array_agg(id) INTO ids FROM (SELECT id FROM prospects WHERE campanha_id = camp AND fonte = 'demo' ORDER BY criado_em LIMIT 3) s;
  IF ids IS NOT NULL THEN
    INSERT INTO prospect_alerts (workspace_id, prospect_id, tipo, detalhe) VALUES
      (ws, ids[1], 'inauguracao_recente', '{"meses": 2}'),
      (ws, ids[2], 'avaliacoes_negativas', '{"nota": 3.2, "avaliacoes": 48}'),
      (ws, ids[3], 'site_fora_do_ar', '{"status": 503}')
    ON CONFLICT (prospect_id, tipo) DO NOTHING;
  END IF;

  SELECT count(*) INTO total FROM prospects WHERE campanha_id = camp;
  FOR i IN 0..13 LOOP
    env := 4 + i * 3; resp := (env * 0.28)::int; qual := (resp * 0.35)::int;
    INSERT INTO campanha_metricas (workspace_id, campanha_id, dia, prospects_total, funil, mensagens_enviadas, respostas, qualificados, custo_usd)
    VALUES (ws, camp, CURRENT_DATE - (13 - i), GREATEST(1, total * (i + 4) / 17), jsonb_build_object('novo', GREATEST(0, 12 - i), 'em_contato', 3 + i / 2, 'engajado', resp / 2, 'qualificado', qual),
            env, resp, qual, round((0.35 + i * 0.22)::numeric, 4))
    ON CONFLICT (campanha_id, dia) DO NOTHING;
  END LOOP;
END $$;
