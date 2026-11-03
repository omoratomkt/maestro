-- Rode com: SUPABASE_ACCESS_TOKEN=... node scripts/teste-isolamento-rls.mjs (o SQL Editor só mostraria o resultado do ROLLBACK).
-- Teste de isolamento (RLS) entre workspaces, executado dentro de uma transação que termina em ROLLBACK:
-- nenhum usuário, workspace ou dado criado aqui permanece no banco.
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@teste.invalid'),
  ('b0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@teste.invalid'),
  ('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-admin@teste.invalid');

INSERT INTO workspaces (id, nome, slug) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'RLS A', 'rls-a'),
  ('b0000000-0000-0000-0000-00000000000b', 'RLS B', 'rls-b');
INSERT INTO workspace_usuarios (workspace_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'operador'),
  ('b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-0000000000b1', 'operador'),
  ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000c1', 'super_admin');
INSERT INTO campanhas (id, workspace_id, nome) VALUES
  ('a0000000-0000-0000-0000-0000000000ca', 'a0000000-0000-0000-0000-00000000000a', 'camp A'),
  ('b0000000-0000-0000-0000-0000000000cb', 'b0000000-0000-0000-0000-00000000000b', 'camp B');
INSERT INTO prospects (id, workspace_id, campanha_id, nome_empresa) VALUES
  ('a0000000-0000-0000-0000-0000000000fa', 'a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000ca', 'prospect A'),
  ('b0000000-0000-0000-0000-0000000000fb', 'b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-0000000000cb', 'prospect B');
INSERT INTO prospect_interacoes (prospect_id, canal, direcao, conteudo) VALUES
  ('a0000000-0000-0000-0000-0000000000fa', 'email', 'out', 'a'), ('b0000000-0000-0000-0000-0000000000fb', 'email', 'out', 'b');
INSERT INTO prospect_estado (prospect_id) VALUES ('a0000000-0000-0000-0000-0000000000fa'), ('b0000000-0000-0000-0000-0000000000fb');
INSERT INTO fila_acoes (workspace_id, prospect_id, campanha_id, tipo, canal, mensagem, razao) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000fa', 'a0000000-0000-0000-0000-0000000000ca', 'followup', 'email', 'm', 'r'),
  ('b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-0000000000fb', 'b0000000-0000-0000-0000-0000000000cb', 'followup', 'email', 'm', 'r');
INSERT INTO leads_qualificados (workspace_id, prospect_id) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000fa'), ('b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-0000000000fb');
INSERT INTO fluxos_automaticos (workspace_id, nome, condicao, tipo_acao, canal_acao, template_mensagem) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'f', '{}', 'followup', 'email', 't'), ('b0000000-0000-0000-0000-00000000000b', 'f', '{}', 'followup', 'email', 't');
INSERT INTO integracoes (workspace_id, tipo, config) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'anthropic', '{"api_key":"segredo-a"}'), ('b0000000-0000-0000-0000-00000000000b', 'anthropic', '{"api_key":"segredo-b"}');
INSERT INTO custos_uso (workspace_id, origem, modelo) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'agent', 'm'), ('b0000000-0000-0000-0000-00000000000b', 'agent', 'm');
INSERT INTO supressoes (workspace_id, tipo, valor) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'email', 'a@x.com'), ('b0000000-0000-0000-0000-00000000000b', 'email', 'b@x.com');
INSERT INTO source_log (workspace_id, campanha_id, fonte, consulta) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000ca', 'x', 'q'), ('b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-0000000000cb', 'x', 'q');
INSERT INTO ciclo_log (resumo) VALUES ('{}');
INSERT INTO ia_chamadas_log (workspace_id, papel, resultado) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'agent', 'ok'), ('b0000000-0000-0000-0000-00000000000b', 'agent', 'ok');
INSERT INTO agente_prompts (workspace_id, papel, instrucoes) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'agente', 'instrucao A'), ('b0000000-0000-0000-0000-00000000000b', 'agente', 'instrucao B');
INSERT INTO eventos_recebidos (workspace_id, canal, corpo_bruto) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'whatsapp', '{"a":1}'), ('b0000000-0000-0000-0000-00000000000b', 'whatsapp', '{"b":1}');
UPDATE prospects SET whatsapp = '(11) 8765-4321' WHERE id = 'a0000000-0000-0000-0000-0000000000fa';

CREATE TEMP TABLE _rls (ordem SERIAL, quem TEXT, teste TEXT, esperado TEXT, obtido TEXT, ok BOOLEAN);
GRANT ALL ON _rls TO authenticated, anon;
GRANT USAGE ON SEQUENCE _rls_ordem_seq TO authenticated, anon;

DO $$
DECLARE
  n INT;
  falhou BOOLEAN;
  A CONSTANT TEXT := '{"sub":"a0000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
  B CONSTANT TEXT := '{"sub":"b0000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
  C CONSTANT TEXT := '{"sub":"c0000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
  WA CONSTANT UUID := 'a0000000-0000-0000-0000-00000000000a';
  WB CONSTANT UUID := 'b0000000-0000-0000-0000-00000000000b';
  PB CONSTANT UUID := 'b0000000-0000-0000-0000-0000000000fb';
  CB CONSTANT UUID := 'b0000000-0000-0000-0000-0000000000cb';
  PA CONSTANT UUID := 'a0000000-0000-0000-0000-0000000000fa';
  CA CONSTANT UUID := 'a0000000-0000-0000-0000-0000000000ca';
  r JSONB := '[]'::JSONB;
  t TEXT;
BEGIN
  ------------------------------------------------------------------ telefone normalizado (gatilho e função)
  SELECT whatsapp_normalizado INTO t FROM prospects WHERE id = PA;
  r := r || jsonb_build_object('quem','banco','teste','gatilho preenche o telefone normalizado (com 9º dígito) e não altera o original','esperado','5511987654321','obtido',coalesce(t,'NULL'),'ok',t = '5511987654321' AND (SELECT whatsapp FROM prospects WHERE id = PA) = '(11) 8765-4321');
  r := r || jsonb_build_object('quem','banco','teste','telefone_canonico ignora o sufixo de JID','esperado','5511987654321','obtido',coalesce(telefone_canonico('551187654321@s.whatsapp.net'),'NULL'),'ok',telefone_canonico('551187654321@s.whatsapp.net') = '5511987654321');

  ------------------------------------------------------------------ operador do workspace A
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', A, true);

  FOREACH t IN ARRAY ARRAY['workspaces','campanhas','prospects','prospect_interacoes','prospect_estado','fila_acoes','leads_qualificados','fluxos_automaticos','custos_uso','supressoes','source_log','ia_chamadas_log','agente_prompts','agente_prompt_versoes'] LOOP
    EXECUTE format('SELECT count(*) FROM %I', t) INTO n;
    r := r || jsonb_build_object('quem','operador A','teste','vê só o próprio em '||t,'esperado','1','obtido',n::text,'ok',n = 1);
  END LOOP;
  SELECT count(*) INTO n FROM integracoes;           r := r || jsonb_build_object('quem','operador A','teste','NÃO lê credenciais (integracoes), nem as do próprio workspace','esperado','0','obtido',n::text,'ok',n = 0);
  SELECT count(*) INTO n FROM ciclo_log;             r := r || jsonb_build_object('quem','operador A','teste','NÃO lê o log global do ciclo','esperado','0','obtido',n::text,'ok',n = 0);
  SELECT count(*) INTO n FROM workspace_usuarios;    r := r || jsonb_build_object('quem','operador A','teste','vê só o próprio vínculo','esperado','1','obtido',n::text,'ok',n = 1);
  SELECT count(*) INTO n FROM prospects WHERE id = PB; r := r || jsonb_build_object('quem','operador A','teste','não enxerga o prospect de B nem pelo id','esperado','0','obtido',n::text,'ok',n = 0);
  SELECT is_super_admin()::int INTO n;               r := r || jsonb_build_object('quem','operador A','teste','is_super_admin() é falso','esperado','0','obtido',n::text,'ok',n = 0);

  UPDATE prospects SET nome_empresa = 'hack' WHERE id = PB;               GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('quem','operador A','teste','UPDATE no prospect de B afeta 0 linhas','esperado','0','obtido',n::text,'ok',n = 0);
  DELETE FROM prospects WHERE id = PB;                                    GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('quem','operador A','teste','DELETE no prospect de B afeta 0 linhas','esperado','0','obtido',n::text,'ok',n = 0);
  UPDATE fila_acoes SET status = 'aprovada' WHERE workspace_id = WB;      GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('quem','operador A','teste','aprovar ação da fila de B afeta 0 linhas','esperado','0','obtido',n::text,'ok',n = 0);
  UPDATE workspace_usuarios SET role = 'super_admin' WHERE user_id = 'a0000000-0000-0000-0000-0000000000a1'; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('quem','operador A','teste','não consegue se promover a super_admin','esperado','0','obtido',n::text,'ok',n = 0);

  falhou := false; BEGIN INSERT INTO prospects (workspace_id, campanha_id, nome_empresa) VALUES (WB, CB, 'invasor'); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','INSERT de prospect no workspace de B é barrado','esperado','erro','obtido',CASE WHEN falhou THEN 'erro' ELSE 'passou' END,'ok',falhou);
  falhou := false; BEGIN INSERT INTO prospect_interacoes (prospect_id, canal, direcao, conteudo) VALUES (PB, 'email', 'in', 'x'); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','INSERT de mensagem em prospect de B é barrado','esperado','erro','obtido',CASE WHEN falhou THEN 'erro' ELSE 'passou' END,'ok',falhou);
  falhou := false; BEGIN INSERT INTO fila_acoes (workspace_id, prospect_id, campanha_id, tipo, canal, mensagem, razao) VALUES (WA, PB, CA, 'followup', 'email', 'm', 'r'); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','ação na fila apontando para prospect de B é barrada','esperado','erro','obtido',CASE WHEN falhou THEN 'erro' ELSE 'passou' END,'ok',falhou);
  falhou := false; BEGIN INSERT INTO integracoes (workspace_id, tipo, config) VALUES (WA, 'apollo', '{}'); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','operador não grava credenciais','esperado','erro','obtido',CASE WHEN falhou THEN 'erro' ELSE 'passou' END,'ok',falhou);
  falhou := false; BEGIN INSERT INTO workspaces (nome, slug) VALUES ('novo', 'novo-rls'); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','operador não cria workspace','esperado','erro','obtido',CASE WHEN falhou THEN 'erro' ELSE 'passou' END,'ok',falhou);
  falhou := false; BEGIN INSERT INTO workspace_usuarios (workspace_id, user_id, role) VALUES (WA, 'b0000000-0000-0000-0000-0000000000b1', 'super_admin'); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','operador não vincula usuários','esperado','erro','obtido',CASE WHEN falhou THEN 'erro' ELSE 'passou' END,'ok',falhou);
  falhou := false; BEGIN INSERT INTO custos_uso (workspace_id, origem, modelo) VALUES (WA, 'agent', 'm'); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','operador não grava custos (só as funções gravam)','esperado','erro','obtido',CASE WHEN falhou THEN 'erro' ELSE 'passou' END,'ok',falhou);
  SELECT count(*) INTO n FROM plataforma_config;  r := r || jsonb_build_object('quem','operador A','teste','NÃO lê o interruptor geral da IA','esperado','0','obtido',n::text,'ok',n = 0);
  falhou := false; BEGIN UPDATE plataforma_config SET valor = '{"pausada": true}'; GET DIAGNOSTICS n = ROW_COUNT; falhou := (n = 0); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','operador não liga o interruptor geral da IA','esperado','0 linhas','obtido',CASE WHEN falhou THEN 'bloqueado' ELSE 'passou' END,'ok',falhou);
  falhou := false; BEGIN INSERT INTO ia_chamadas_log (workspace_id, papel, resultado) VALUES (WA, 'agent', 'ok'); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','operador não grava o registro de chamadas de IA (só as funções)','esperado','erro','obtido',CASE WHEN falhou THEN 'erro' ELSE 'passou' END,'ok',falhou);
  falhou := false; BEGIN UPDATE agente_prompts SET instrucoes = 'hack' WHERE workspace_id = WA; GET DIAGNOSTICS n = ROW_COUNT; falhou := (n = 0); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','operador não edita as instruções do agente (só o super_admin)','esperado','0 linhas','obtido',CASE WHEN falhou THEN 'bloqueado' ELSE 'passou' END,'ok',falhou);
  falhou := false; BEGIN INSERT INTO agente_prompt_versoes (workspace_id, papel, instrucoes) VALUES (WA, 'agente', 'x'); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','operador não grava versões de prompt (só o gatilho)','esperado','erro','obtido',CASE WHEN falhou THEN 'erro' ELSE 'passou' END,'ok',falhou);
  falhou := false; n := 0; BEGIN SELECT count(*) INTO n FROM eventos_recebidos; EXCEPTION WHEN insufficient_privilege THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','não lê eventos_recebidos (só as funções), nem os do próprio workspace','esperado','0 linhas','obtido',CASE WHEN falhou THEN 'sem permissão' ELSE n::text END,'ok',(falhou OR n = 0));
  falhou := false; BEGIN INSERT INTO eventos_recebidos (workspace_id, canal, corpo_bruto) VALUES (WA, 'whatsapp', '{}'); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador A','teste','operador não grava eventos_recebidos','esperado','erro','obtido',CASE WHEN falhou THEN 'erro' ELSE 'passou' END,'ok',falhou);

  ------------------------------------------------------------------ operador do workspace B
  EXECUTE 'RESET ROLE'; EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', B, true);
  SELECT count(*) INTO n FROM prospects;          r := r || jsonb_build_object('quem','operador B','teste','vê só o próprio prospect','esperado','1','obtido',n::text,'ok',n = 1);
  SELECT count(*) INTO n FROM prospects WHERE id = PA; r := r || jsonb_build_object('quem','operador B','teste','não enxerga o prospect de A','esperado','0','obtido',n::text,'ok',n = 0);
  SELECT count(*) INTO n FROM campanhas WHERE id = CA; r := r || jsonb_build_object('quem','operador B','teste','não enxerga a campanha de A','esperado','0','obtido',n::text,'ok',n = 0);
  falhou := false; n := 0; BEGIN SELECT count(*) INTO n FROM notificacoes_log; EXCEPTION WHEN insufficient_privilege THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador B','teste','não lê notificacoes_log (só as funções)','esperado','0 linhas','obtido',CASE WHEN falhou THEN 'sem permissão' ELSE n::text END,'ok',(falhou OR n = 0));
  SELECT count(*) INTO n FROM prospect_alerts WHERE workspace_id = WA; r := r || jsonb_build_object('quem','operador B','teste','não vê alertas de A','esperado','0','obtido',n::text,'ok',n = 0);
  SELECT count(*) INTO n FROM campanha_metricas WHERE workspace_id = WA; r := r || jsonb_build_object('quem','operador B','teste','não vê métricas de A','esperado','0','obtido',n::text,'ok',n = 0);
  SELECT count(*) INTO n FROM ia_chamadas_log WHERE workspace_id = WA; r := r || jsonb_build_object('quem','operador B','teste','não vê o registro de IA de A','esperado','0','obtido',n::text,'ok',n = 0);
  SELECT count(*) INTO n FROM agente_prompts WHERE workspace_id = WA; r := r || jsonb_build_object('quem','operador B','teste','não vê as instruções do agente de A','esperado','0','obtido',n::text,'ok',n = 0);
  SELECT count(*) INTO n FROM agente_prompt_versoes WHERE workspace_id = WA; r := r || jsonb_build_object('quem','operador B','teste','não vê as versões de prompt de A','esperado','0','obtido',n::text,'ok',n = 0);
  falhou := false; n := 0; BEGIN SELECT count(*) INTO n FROM eventos_recebidos WHERE workspace_id = WA; EXCEPTION WHEN insufficient_privilege THEN falhou := true; END;
  r := r || jsonb_build_object('quem','operador B','teste','não vê os eventos recebidos de A','esperado','0 linhas','obtido',CASE WHEN falhou THEN 'sem permissão' ELSE n::text END,'ok',(falhou OR n = 0));

  ------------------------------------------------------------------ super_admin
  EXECUTE 'RESET ROLE'; EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', C, true);
  SELECT count(*) INTO n FROM prospects WHERE id IN (PA, PB); r := r || jsonb_build_object('quem','super_admin','teste','enxerga os dois workspaces','esperado','2','obtido',n::text,'ok',n = 2);
  SELECT count(*) INTO n FROM integracoes WHERE workspace_id IN (WA, WB); r := r || jsonb_build_object('quem','super_admin','teste','lê as integrações','esperado','2','obtido',n::text,'ok',n = 2);
  falhou := false; BEGIN UPDATE integracoes SET config = '{}' WHERE workspace_id = WA; GET DIAGNOSTICS n = ROW_COUNT; falhou := (n = 0); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','super_admin','teste','não altera credenciais direto (só pela função que criptografa)','esperado','0 linhas','obtido',CASE WHEN falhou THEN 'bloqueado' ELSE 'passou' END,'ok',falhou);
  SELECT count(*) INTO n FROM ciclo_log;          r := r || jsonb_build_object('quem','super_admin','teste','lê o log global do ciclo','esperado','1+','obtido',n::text,'ok',n >= 1);
  SELECT count(*) INTO n FROM plataforma_config WHERE chave = 'ia_pausada'; r := r || jsonb_build_object('quem','super_admin','teste','lê o interruptor geral da IA','esperado','1','obtido',n::text,'ok',n = 1);
  UPDATE plataforma_config SET valor = '{"pausada": true}' WHERE chave = 'ia_pausada'; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('quem','super_admin','teste','liga o interruptor geral da IA','esperado','1','obtido',n::text,'ok',n = 1);
  UPDATE agente_prompts SET instrucoes = 'instrucao A v2' WHERE workspace_id = WA; GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('quem','super_admin','teste','edita as instruções do agente','esperado','1','obtido',n::text,'ok',n = 1);
  SELECT count(*) INTO n FROM agente_prompt_versoes WHERE workspace_id = WA; r := r || jsonb_build_object('quem','super_admin','teste','a edição gerou uma versão nova (histórico por gatilho)','esperado','2','obtido',n::text,'ok',n = 2);
  SELECT is_super_admin()::int INTO n;            r := r || jsonb_build_object('quem','super_admin','teste','is_super_admin() é verdadeiro','esperado','1','obtido',n::text,'ok',n = 1);

  ------------------------------------------------------------------ anônimo (chave anon, sem login)
  EXECUTE 'RESET ROLE'; EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  FOREACH t IN ARRAY ARRAY['workspaces','workspace_usuarios','playbooks','campanhas','prospects','prospect_interacoes','prospect_estado','fila_acoes','fluxos_automaticos','leads_qualificados','integracoes','custos_uso','supressoes','source_log','ciclo_log','prospect_alerts','campanha_metricas','notificacoes_log','plataforma_config','ia_chamadas_log','agente_prompts','agente_prompt_versoes','eventos_recebidos'] LOOP
    falhou := false; n := 0;
    BEGIN EXECUTE format('SELECT count(*) FROM %I', t) INTO n; EXCEPTION WHEN insufficient_privilege THEN falhou := true; END;
    r := r || jsonb_build_object('quem','anônimo','teste','não lê '||t,'esperado','0 linhas','obtido',CASE WHEN falhou THEN 'sem permissão' ELSE n::text END,'ok',(falhou OR n = 0));
  END LOOP;
  falhou := false; BEGIN INSERT INTO prospects (workspace_id, campanha_id, nome_empresa) VALUES (WA, CA, 'anon'); EXCEPTION WHEN OTHERS THEN falhou := true; END;
  r := r || jsonb_build_object('quem','anônimo','teste','não grava prospects','esperado','erro','obtido',CASE WHEN falhou THEN 'erro' ELSE 'passou' END,'ok',falhou);

  EXECUTE 'RESET ROLE';
  PERFORM set_config('maestro.rls_result', r::text, true);
END $$;

SELECT jsonb_pretty(current_setting('maestro.rls_result')::jsonb) AS _ignorado WHERE false;
SELECT jsonb_agg(x ORDER BY ord) AS resultados
FROM (SELECT e AS x, ord FROM jsonb_array_elements(current_setting('maestro.rls_result')::jsonb) WITH ORDINALITY AS t(e, ord)) s;

ROLLBACK;
