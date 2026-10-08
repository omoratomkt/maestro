-- 000 — CONFERÊNCIA (rodar ANTES das migrations 001–011, no SQL Editor)
-- Esperado: 0 linhas. Se listar tabelas, o banco não está vazio — parar e avisar.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('workspaces','workspace_usuarios','playbooks','campanhas','prospects',
                     'prospect_interacoes','prospect_estado','fila_acoes','fluxos_automaticos',
                     'leads_qualificados','integracoes');

-- CONFERÊNCIA PÓS (rodar DEPOIS das 001–011). Esperado: 11 linhas, todas rls_ativo = true.
-- SELECT c.relname AS tabela, c.relrowsecurity AS rls_ativo
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1;
