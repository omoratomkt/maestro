-- Remove TODOS os dados de demonstração (campanha "[DEMO]..." e tudo que depende dela).
-- Não toca em nenhuma outra campanha.

DO $$
DECLARE camp_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO camp_ids FROM campanhas WHERE nome LIKE '[DEMO]%';
  IF camp_ids IS NULL THEN RAISE NOTICE 'Nada a remover.'; RETURN; END IF;

  DELETE FROM fila_acoes WHERE campanha_id = ANY(camp_ids);
  DELETE FROM leads_qualificados WHERE prospect_id IN (SELECT id FROM prospects WHERE campanha_id = ANY(camp_ids));
  DELETE FROM fluxos_automaticos WHERE campanha_id = ANY(camp_ids);
  DELETE FROM prospects WHERE campanha_id = ANY(camp_ids); -- interacoes e estado saem em cascata
  DELETE FROM campanhas WHERE id = ANY(camp_ids);
END $$;

SELECT (SELECT count(*) FROM campanhas WHERE nome LIKE '[DEMO]%') AS campanhas_demo,
       (SELECT count(*) FROM prospects WHERE fonte = 'demo') AS prospects_demo;
