-- 021 — resumo_operacional(p_ws): contagens do que precisa de atenção humana (usado no resumo diário por email).
-- Ignora a campanha de demonstração.
CREATE OR REPLACE FUNCTION resumo_operacional(p_ws UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pendentes_na_fila', (
      SELECT count(*) FROM fila_acoes f JOIN campanhas c ON c.id = f.campanha_id
      WHERE f.workspace_id = p_ws AND f.status = 'pendente' AND c.nome NOT LIKE '[DEMO]%'),
    'falhas_de_envio', (
      SELECT count(*) FROM fila_acoes f JOIN campanhas c ON c.id = f.campanha_id
      WHERE f.workspace_id = p_ws AND f.status = 'aprovada' AND f.erro_execucao IS NOT NULL
        AND f.erro_execucao NOT LIKE 'Limite diário%' AND c.nome NOT LIKE '[DEMO]%'),
    'aguardando_humano', (
      SELECT count(*) FROM prospects p
      JOIN prospect_estado e ON e.prospect_id = p.id
      JOIN campanhas c ON c.id = p.campanha_id
      WHERE p.workspace_id = p_ws AND c.nome NOT LIKE '[DEMO]%'
        AND p.status IN ('em_contato', 'engajado', 'qualificado')
        AND e.aguardando = 'nenhum' AND e.proxima_acao_em IS NULL),
    'leads_sem_reuniao', (
      SELECT count(*) FROM leads_qualificados l JOIN prospects p ON p.id = l.prospect_id JOIN campanhas c ON c.id = p.campanha_id
      WHERE l.workspace_id = p_ws AND l.status_reuniao = 'pendente' AND c.nome NOT LIKE '[DEMO]%')
  )
$$;
REVOKE ALL ON FUNCTION resumo_operacional(UUID) FROM PUBLIC, anon;
