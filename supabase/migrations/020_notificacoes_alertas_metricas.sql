-- 020 — notificações ao operador, alertas de timing, histórico diário das campanhas e métricas por campanha.

-- ───────────────────────────── notificacoes_log
-- Evita avisar duas vezes sobre o mesmo fato e garante 1 resumo por dia. Só as Edge Functions (service_role) usam.
CREATE TABLE notificacoes_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL,  -- 'lead_qualificado' | 'reuniao_agendada' | 'reuniao_cancelada' | 'aguarda_humano' | 'resumo_diario'
  chave        TEXT NOT NULL,  -- id do fato (lead, prospect, mensagem) ou a data do resumo
  enviado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, tipo, chave)
);
ALTER TABLE notificacoes_log ENABLE ROW LEVEL SECURITY;  -- sem policies: nenhum usuário lê ou escreve; a service_role ignora o RLS

-- ───────────────────────────── prospect_alerts
-- Sinais de timing detectados no enriquecimento (inauguração recente, avaliações ruins, site fora do ar).
CREATE TABLE prospect_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prospect_id  UUID NOT NULL,
  tipo         TEXT NOT NULL,
  detalhe      JSONB NOT NULL DEFAULT '{}',
  lido         BOOLEAN NOT NULL DEFAULT false,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prospect_id, tipo),
  FOREIGN KEY (prospect_id, workspace_id) REFERENCES prospects (id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX idx_alerts_workspace_nao_lidos ON prospect_alerts(workspace_id, criado_em DESC) WHERE NOT lido;
ALTER TABLE prospect_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY alerts_ws ON prospect_alerts FOR ALL TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin())
  WITH CHECK (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

-- ───────────────────────────── campanha_metricas (foto diária, valores acumulados até o fim do dia)
CREATE TABLE campanha_metricas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campanha_id      UUID NOT NULL,
  dia              DATE NOT NULL,
  prospects_total  INT NOT NULL DEFAULT 0,
  funil            JSONB NOT NULL DEFAULT '{}',  -- {"novo": 10, "engajado": 3, ...}
  mensagens_enviadas INT NOT NULL DEFAULT 0,
  respostas        INT NOT NULL DEFAULT 0,
  qualificados     INT NOT NULL DEFAULT 0,
  custo_usd        NUMERIC(10,4) NOT NULL DEFAULT 0,
  UNIQUE (campanha_id, dia),
  FOREIGN KEY (campanha_id, workspace_id) REFERENCES campanhas (id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX idx_campanha_metricas_ws_dia ON campanha_metricas(workspace_id, dia DESC);
ALTER TABLE campanha_metricas ENABLE ROW LEVEL SECURITY;
CREATE POLICY campanha_metricas_select ON campanha_metricas FOR SELECT TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

-- Grava (ou atualiza) a foto de hoje (dia de Brasília) de cada campanha real. Chamada pelo agent-loop.
CREATE OR REPLACE FUNCTION registrar_snapshot_metricas() RETURNS INT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n INT;
BEGIN
  INSERT INTO campanha_metricas (workspace_id, campanha_id, dia, prospects_total, funil, mensagens_enviadas, respostas, qualificados, custo_usd)
  SELECT c.workspace_id, c.id, (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    (SELECT count(*) FROM prospects p WHERE p.campanha_id = c.id),
    COALESCE((SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) AS n FROM prospects p WHERE p.campanha_id = c.id GROUP BY status) s), '{}'::jsonb),
    (SELECT count(*) FROM prospect_interacoes i JOIN prospects p ON p.id = i.prospect_id WHERE p.campanha_id = c.id AND i.direcao = 'out'),
    (SELECT count(*) FROM prospect_interacoes i JOIN prospects p ON p.id = i.prospect_id WHERE p.campanha_id = c.id AND i.direcao = 'in'),
    (SELECT count(*) FROM leads_qualificados l JOIN prospects p ON p.id = l.prospect_id WHERE p.campanha_id = c.id),
    COALESCE((SELECT sum(cu.custo_usd) FROM custos_uso cu JOIN prospects p ON p.id = cu.prospect_id WHERE p.campanha_id = c.id), 0)
  FROM campanhas c
  WHERE c.nome NOT LIKE '[DEMO]%'
  ON CONFLICT (campanha_id, dia) DO UPDATE SET
    prospects_total = EXCLUDED.prospects_total, funil = EXCLUDED.funil, mensagens_enviadas = EXCLUDED.mensagens_enviadas,
    respostas = EXCLUDED.respostas, qualificados = EXCLUDED.qualificados, custo_usd = EXCLUDED.custo_usd;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION registrar_snapshot_metricas() FROM PUBLIC, anon, authenticated;

-- ───────────────────────────── métricas: filtro por campanha + comparação entre campanhas
DROP FUNCTION IF EXISTS metricas_resumo(INT, UUID);

CREATE OR REPLACE FUNCTION metricas_resumo(dias INT DEFAULT 30, p_ws UUID DEFAULT NULL, p_camp UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH janela AS (SELECT now() - make_interval(days => dias) AS desde),
  pr AS (SELECT * FROM prospects WHERE (p_ws IS NULL OR workspace_id = p_ws) AND (p_camp IS NULL OR campanha_id = p_camp)),
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
  custo AS (
    SELECT COALESCE(sum(c.custo_usd), 0) AS total FROM custos_uso c, janela
    WHERE c.criado_em >= janela.desde
      AND (p_ws IS NULL OR c.workspace_id = p_ws)
      AND (p_camp IS NULL OR c.prospect_id IN (SELECT id FROM pr))
  ),
  leads AS (SELECT l.* FROM leads_qualificados l, janela WHERE l.qualificado_em >= janela.desde AND l.prospect_id IN (SELECT id FROM pr)),
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

CREATE OR REPLACE FUNCTION metricas_por_campanha(dias INT DEFAULT 30, p_ws UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH janela AS (SELECT now() - make_interval(days => dias) AS desde)
  SELECT COALESCE(jsonb_agg(linha ORDER BY (linha ->> 'prospects_total')::int DESC), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'campanha_id', c.id, 'nome', c.nome, 'status', c.status,
      'prospects_total', (SELECT count(*) FROM prospects p WHERE p.campanha_id = c.id),
      'contatados',   (SELECT count(DISTINCT i.prospect_id) FROM prospect_interacoes i JOIN prospects p ON p.id = i.prospect_id, janela
                       WHERE p.campanha_id = c.id AND i.direcao = 'out' AND i.enviado_em >= janela.desde),
      'responderam',  (SELECT count(DISTINCT i.prospect_id) FROM prospect_interacoes i JOIN prospects p ON p.id = i.prospect_id, janela
                       WHERE p.campanha_id = c.id AND i.direcao = 'in' AND i.enviado_em >= janela.desde),
      'qualificados', (SELECT count(*) FROM leads_qualificados l JOIN prospects p ON p.id = l.prospect_id, janela
                       WHERE p.campanha_id = c.id AND l.qualificado_em >= janela.desde),
      'custo_usd',    COALESCE((SELECT sum(cu.custo_usd) FROM custos_uso cu JOIN prospects p ON p.id = cu.prospect_id, janela
                       WHERE p.campanha_id = c.id AND cu.criado_em >= janela.desde), 0)
    ) AS linha
    FROM campanhas c WHERE p_ws IS NULL OR c.workspace_id = p_ws
  ) t
$$;
