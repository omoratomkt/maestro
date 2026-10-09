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
  ------------------------------------------------------------------ operador do workspace A
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', A, true);

  FOREACH t IN ARRAY ARRAY['workspaces','campanhas','prospects','prospect_interacoes','prospect_estado','fila_acoes','leads_qualificados','fluxos_automaticos','custos_uso','supressoes','source_log'] LOOP
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

  ------------------------------------------------------------------ operador do workspace B
  EXECUTE 'RESET ROLE'; EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', B, true);
  SELECT count(*) INTO n FROM prospects;          r := r || jsonb_build_object('quem','operador B','teste','vê só o próprio prospect','esperado','1','obtido',n::text,'ok',n = 1);
  SELECT count(*) INTO n FROM prospects WHERE id = PA; r := r || jsonb_build_object('quem','operador B','teste','não enxerga o prospect de A','esperado','0','obtido',n::text,'ok',n = 0);
  SELECT count(*) INTO n FROM campanhas WHERE id = CA; r := r || jsonb_build_object('quem','operador B','teste','não enxerga a campanha de A','esperado','0','obtido',n::text,'ok',n = 0);

  ------------------------------------------------------------------ super_admin
  EXECUTE 'RESET ROLE'; EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', C, true);
  SELECT count(*) INTO n FROM prospects WHERE id IN (PA, PB); r := r || jsonb_build_object('quem','super_admin','teste','enxerga os dois workspaces','esperado','2','obtido',n::text,'ok',n = 2);
  SELECT count(*) INTO n FROM integracoes WHERE workspace_id IN (WA, WB); r := r || jsonb_build_object('quem','super_admin','teste','lê as integrações','esperado','2','obtido',n::text,'ok',n = 2);
  SELECT count(*) INTO n FROM ciclo_log;          r := r || jsonb_build_object('quem','super_admin','teste','lê o log global do ciclo','esperado','1+','obtido',n::text,'ok',n >= 1);
  SELECT is_super_admin()::int INTO n;            r := r || jsonb_build_object('quem','super_admin','teste','is_super_admin() é verdadeiro','esperado','1','obtido',n::text,'ok',n = 1);

  ------------------------------------------------------------------ anônimo (chave anon, sem login)
  EXECUTE 'RESET ROLE'; EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  FOREACH t IN ARRAY ARRAY['workspaces','workspace_usuarios','playbooks','campanhas','prospects','prospect_interacoes','prospect_estado','fila_acoes','fluxos_automaticos','leads_qualificados','integracoes','custos_uso','supressoes','source_log','ciclo_log'] LOOP
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
