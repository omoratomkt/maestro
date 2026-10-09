-- MAESTRO — migrations 001..011 concatenadas (para o SQL Editor). Gerado de supabase/migrations/.

-- ===== 001_workspaces.sql =====
-- 001 â€” workspaces + workspace_usuarios

CREATE TABLE workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plano       TEXT NOT NULL DEFAULT 'starter', -- 'demo' | 'starter' | 'pro'
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UsuÃ¡rios do workspace
CREATE TABLE workspace_usuarios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'operador', -- 'operador' | 'admin' | 'super_admin'
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

-- ===== 002_playbooks.sql =====
-- 002 â€” playbooks

CREATE TABLE playbooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  descricao   TEXT,
  icone       TEXT, -- nome do Ã­cone Lucide
  -- Defaults pre-configurados
  fontes_padrao             TEXT[] DEFAULT '{}',     -- ['google_places', 'apollo', ...]
  canais_padrao             TEXT[] DEFAULT '{}',     -- ['whatsapp_evolution', 'email', ...]
  icp_padrao                JSONB  DEFAULT '{}',
  persona_padrao            JSONB  DEFAULT '{}',
  criterios_qualificacao_padrao JSONB DEFAULT '[]',
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== 003_campanhas.sql =====
-- 003 â€” campanhas

CREATE TABLE campanhas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  playbook_id  UUID REFERENCES playbooks(id),  -- null = campanha personalizada
  nome         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'rascunho', -- 'rascunho' | 'ativa' | 'pausada' | 'encerrada'

  -- ICP
  segmento              TEXT,
  cargos_alvo           TEXT[] DEFAULT '{}',
  regioes               TEXT[] DEFAULT '{}',
  score_minimo          INT NOT NULL DEFAULT 60,
  criterios_exclusao    JSONB DEFAULT '[]',
  volume_semanal        INT DEFAULT 50,

  -- Persona do agente
  persona_nome          TEXT,
  persona_tom           TEXT,   -- 'formal' | 'consultivo' | 'direto' | 'amigavel'
  persona_produto       TEXT,
  persona_argumentos    TEXT[] DEFAULT '{}',
  persona_objecoes      JSONB DEFAULT '[]',  -- [{objecao, resposta}]

  -- QualificaÃ§Ã£o
  criterios_qualificacao JSONB DEFAULT '[]', -- [{campo, pergunta, obrigatorio}]

  -- Fontes e canais ativos
  fontes   TEXT[] DEFAULT '{}', -- ['google_places', 'apollo', 'csv', 'linkedin_scraper', 'instagram_scraper', 'cnpj', 'inbound']
  canais   TEXT[] DEFAULT '{}', -- ['whatsapp_evolution', 'whatsapp_meta', 'email', 'linkedin', 'instagram']

  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campanhas_workspace ON campanhas(workspace_id);
CREATE INDEX idx_campanhas_status ON campanhas(status);

-- ===== 004_prospects.sql =====
-- 004 â€” prospects

CREATE TABLE prospects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campanha_id  UUID NOT NULL REFERENCES campanhas(id),

  -- IdentificaÃ§Ã£o
  nome_empresa  TEXT NOT NULL,
  nome_contato  TEXT,
  cargo         TEXT,

  -- Canais de contato
  whatsapp      TEXT,
  email         TEXT,
  linkedin_url  TEXT,
  instagram_handle TEXT,

  -- Dados da empresa
  website       TEXT,
  segmento      TEXT,
  cidade        TEXT,
  estado        TEXT,
  cnpj          TEXT,

  -- Enriquecimento
  score               INT,          -- 0â€“100 calculado na Camada 2
  score_detalhes      JSONB DEFAULT '{}',  -- breakdown por critÃ©rio
  dados_enriquecimento JSONB DEFAULT '{}', -- SimilarWeb, CNPJ, Instagram, etc.
  sinais_timing       JSONB DEFAULT '{}',  -- {mudanca_cargo, contratacoes, investimento, etc.}
  enriched_at         TIMESTAMPTZ,

  -- Status no pipeline
  -- 'novo' | 'em_contato' | 'engajado' | 'qualificado' | 'agendado' | 'convertido' | 'descartado' | 'pausado'
  status          TEXT NOT NULL DEFAULT 'novo',
  canal_principal TEXT,  -- canal onde hÃ¡ mais engajamento

  -- Fonte
  fonte    TEXT,  -- 'google_places' | 'apollo' | 'csv' | 'linkedin_scraper' | 'instagram_scraper' | 'cnpj' | 'inbound'
  fonte_id TEXT,  -- ID na fonte original (ex: google_place_id)

  -- Datas chave
  primeiro_contato_em  TIMESTAMPTZ,
  ultima_interacao_em  TIMESTAMPTZ,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prospects_workspace ON prospects(workspace_id);
CREATE INDEX idx_prospects_campanha ON prospects(campanha_id);
CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_prospects_score ON prospects(score DESC);
CREATE INDEX idx_prospects_whatsapp ON prospects(whatsapp);
CREATE INDEX idx_prospects_fonte_id ON prospects(fonte_id);

-- ===== 005_interacoes.sql =====
-- 005 â€” prospect_interacoes

CREATE TABLE prospect_interacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,

  canal    TEXT NOT NULL,  -- 'whatsapp' | 'email' | 'linkedin' | 'instagram'
  direcao  TEXT NOT NULL CHECK (direcao IN ('in', 'out')),
  conteudo TEXT NOT NULL,
  tipo     TEXT NOT NULL DEFAULT 'text' CHECK (tipo IN ('text', 'audio', 'image', 'document', 'template')),

  -- Status do envio (para mensagens 'out')
  status   TEXT DEFAULT 'enviado', -- 'enviado' | 'entregue' | 'lido' | 'respondido' | 'erro'

  -- Metadados do canal
  metadata JSONB DEFAULT '{}',  -- {message_id, thread_id, template_name, etc.}

  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interacoes_prospect ON prospect_interacoes(prospect_id);
CREATE INDEX idx_interacoes_enviado_em ON prospect_interacoes(enviado_em DESC);
CREATE INDEX idx_interacoes_canal ON prospect_interacoes(canal);

-- ===== 006_estado_agente.sql =====
-- 006 â€” prospect_estado
-- Estado do agente por prospect â€” o que estÃ¡ monitorando e quando vai agir.

CREATE TABLE prospect_estado (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE UNIQUE,

  -- O que o agente estÃ¡ aguardando
  aguardando TEXT, -- 'resposta' | 'tempo' | 'sinal' | 'aprovacao' | 'nenhum'

  -- Quando o agente deve checar novamente
  proxima_acao_em TIMESTAMPTZ,

  -- Contexto comprimido da conversa para o agente
  contexto_resumo TEXT,

  -- Controle de tentativas por canal
  tentativas_whatsapp  INT DEFAULT 0,
  tentativas_email     INT DEFAULT 0,
  tentativas_linkedin  INT DEFAULT 0,
  tentativas_instagram INT DEFAULT 0,

  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_estado_proxima_acao ON prospect_estado(proxima_acao_em)
  WHERE proxima_acao_em IS NOT NULL;

-- ===== 007_fila_acoes.sql =====
-- 007 â€” fila_acoes
-- AÃ§Ãµes propostas pelo agente aguardando aprovaÃ§Ã£o humana (ou execuÃ§Ã£o automÃ¡tica).
--
-- NOTA: fluxo_automatico_id referencia fluxos_automaticos, criada sÃ³ na 008.
-- A coluna Ã© criada aqui sem FK; a constraint Ã© adicionada ao final da 008.

CREATE TABLE fila_acoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prospect_id  UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  campanha_id  UUID NOT NULL REFERENCES campanhas(id),

  -- A aÃ§Ã£o proposta
  tipo     TEXT NOT NULL, -- 'primeira_mensagem' | 'followup' | 'resposta' | 'reengajamento' | 'encerrar'
  canal    TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  razao    TEXT NOT NULL,  -- por que o agente quer fazer isso (mostrado no painel)

  -- Status
  -- 'pendente' | 'aprovada' | 'rejeitada' | 'executada' | 'expirada' | 'cancelada'
  status TEXT NOT NULL DEFAULT 'pendente',

  -- AprovaÃ§Ã£o
  aprovada_por  UUID REFERENCES auth.users(id),
  aprovada_em   TIMESTAMPTZ,
  mensagem_editada TEXT,  -- se o operador editou antes de aprovar

  -- ExecuÃ§Ã£o
  executada_em  TIMESTAMPTZ,
  erro_execucao TEXT,

  -- Se veio de um fluxo automÃ¡tico (FK adicionada na 008)
  fluxo_automatico_id UUID,

  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em  TIMESTAMPTZ  -- aÃ§Ã£o pendente expira apÃ³s X horas sem aÃ§Ã£o
);

CREATE INDEX idx_fila_workspace_status ON fila_acoes(workspace_id, status);
CREATE INDEX idx_fila_prospect ON fila_acoes(prospect_id);
CREATE INDEX idx_fila_pendente ON fila_acoes(workspace_id, criado_em DESC)
  WHERE status = 'pendente';

-- ===== 008_fluxos_automaticos.sql =====
-- 008 â€” fluxos_automaticos
-- PadrÃµes que o operador promoveu para execuÃ§Ã£o automÃ¡tica.

CREATE TABLE fluxos_automaticos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campanha_id  UUID REFERENCES campanhas(id),  -- null = vale para todo o workspace

  nome      TEXT NOT NULL,
  descricao TEXT,

  -- CondiÃ§Ã£o de disparo
  condicao JSONB NOT NULL,
  -- Exemplo: {"evento": "email_aberto_sem_resposta", "canal": "email", "delay_horas": 24}

  -- AÃ§Ã£o a executar
  tipo_acao         TEXT NOT NULL,
  canal_acao        TEXT NOT NULL,
  template_mensagem TEXT NOT NULL,
  delay_horas       INT DEFAULT 0,

  -- Estado
  ativo BOOLEAN NOT NULL DEFAULT true,

  -- Performance histÃ³rica
  total_execucoes INT DEFAULT 0,
  total_respostas INT DEFAULT 0,
  taxa_sucesso    NUMERIC(5,2),

  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fluxos_workspace ON fluxos_automaticos(workspace_id)
  WHERE ativo = true;

-- FK pendente da 007 (fila_acoes.fluxo_automatico_id)
ALTER TABLE fila_acoes
  ADD CONSTRAINT fila_acoes_fluxo_automatico_id_fkey
  FOREIGN KEY (fluxo_automatico_id) REFERENCES fluxos_automaticos(id);

-- ===== 009_leads_qualificados.sql =====
-- 009 â€” leads_qualificados
-- Prospects que completaram qualificaÃ§Ã£o â€” aguardam reuniÃ£o.

CREATE TABLE leads_qualificados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prospect_id  UUID NOT NULL REFERENCES prospects(id) UNIQUE,

  -- Briefing gerado pelo agente
  briefing JSONB NOT NULL DEFAULT '{}',
  -- {
  --   dor_principal: text,
  --   budget: text,
  --   timeline: text,
  --   e_decisor: boolean,
  --   objecoes: text[],
  --   sentimento: 'positivo' | 'neutro' | 'cÃ©tico',
  --   resumo_conversa: text,
  --   pontos_chave: text[]
  -- }

  score_temperatura INT, -- 1â€“10

  proximo_passo TEXT,

  -- ReuniÃ£o
  -- 'pendente' | 'agendada' | 'realizada' | 'no_show' | 'cancelada'
  status_reuniao   TEXT DEFAULT 'pendente',
  reuniao_em       TIMESTAMPTZ,
  calcom_booking_id TEXT,

  -- IntegraÃ§Ã£o CRM
  crm_lead_id           TEXT,   -- ID no morato-crm ou CRM externo
  crm_webhook_enviado   BOOLEAN DEFAULT false,
  crm_webhook_enviado_em TIMESTAMPTZ,

  qualificado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_workspace ON leads_qualificados(workspace_id);
CREATE INDEX idx_leads_status_reuniao ON leads_qualificados(status_reuniao);

-- ===== 010_integracoes.sql =====
-- 010 â€” integracoes
-- Credenciais e configuraÃ§Ãµes de cada integraÃ§Ã£o por workspace.

CREATE TABLE integracoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Tipo da integraÃ§Ã£o
  tipo TEXT NOT NULL,
  -- Canais de saÃ­da:
  --   'whatsapp_evolution' | 'whatsapp_meta' | 'email_instantly' | 'email_mailreach'
  --   'linkedin_expandi'   | 'linkedin_dripify' | 'instagram_meta'
  -- Fontes de dados:
  --   'google_places' | 'apollo' | 'hunter' | 'zerobounce' | 'similarweb'
  --   'crunchbase' | 'phantombuster' | 'apify'
  -- IA:
  --   'anthropic'
  -- CRM:
  --   'morato_crm' | 'webhook_crm'
  -- CalendÃ¡rio:
  --   'calcom'

  config  JSONB NOT NULL DEFAULT '{}',  -- credenciais e configuraÃ§Ãµes (criptografadas)
  ativo   BOOLEAN NOT NULL DEFAULT true,

  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (workspace_id, tipo)
);

-- ===== 011_rls.sql =====
-- 011 â€” RLS em todas as tabelas
-- service_role ignora RLS (Edge Functions). authenticated acessa sÃ³ o prÃ³prio workspace.

ALTER TABLE workspaces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_usuarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_interacoes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_estado       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fila_acoes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE fluxos_automaticos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_qualificados    ENABLE ROW LEVEL SECURITY;
ALTER TABLE integracoes           ENABLE ROW LEVEL SECURITY;

-- Helpers (SECURITY DEFINER evita recursÃ£o de RLS em workspace_usuarios)
CREATE OR REPLACE FUNCTION get_workspace_ids_for_user()
RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(ARRAY(
    SELECT workspace_id FROM workspace_usuarios
    WHERE user_id = auth.uid()
  ), '{}')
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_usuarios
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
$$;

-- workspaces: membro lÃª o seu; super_admin gerencia todos
CREATE POLICY workspaces_select ON workspaces FOR SELECT TO authenticated
  USING (id = ANY(get_workspace_ids_for_user()) OR is_super_admin());
CREATE POLICY workspaces_admin ON workspaces FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- workspace_usuarios: usuÃ¡rio vÃª as prÃ³prias linhas; super_admin gerencia tudo
CREATE POLICY wu_select ON workspace_usuarios FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_super_admin());
CREATE POLICY wu_admin ON workspace_usuarios FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- playbooks: todos autenticados leem ativos (wizard); super_admin gerencia
CREATE POLICY playbooks_select ON playbooks FOR SELECT TO authenticated
  USING (ativo OR is_super_admin());
CREATE POLICY playbooks_admin ON playbooks FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Tabelas com workspace_id direto
CREATE POLICY campanhas_ws ON campanhas FOR ALL TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin())
  WITH CHECK (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

CREATE POLICY prospects_ws ON prospects FOR ALL TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin())
  WITH CHECK (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

CREATE POLICY fila_acoes_ws ON fila_acoes FOR ALL TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin())
  WITH CHECK (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

CREATE POLICY fluxos_ws ON fluxos_automaticos FOR ALL TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin())
  WITH CHECK (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

CREATE POLICY leads_ws ON leads_qualificados FOR ALL TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin())
  WITH CHECK (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

-- Tabelas filhas de prospects (sem workspace_id): herdam via prospect_id
CREATE POLICY interacoes_ws ON prospect_interacoes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM prospects p WHERE p.id = prospect_id
         AND (p.workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM prospects p WHERE p.id = prospect_id
         AND (p.workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin())));

CREATE POLICY estado_ws ON prospect_estado FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM prospects p WHERE p.id = prospect_id
         AND (p.workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM prospects p WHERE p.id = prospect_id
         AND (p.workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin())));

-- integracoes guarda credenciais: sÃ³ super_admin acessa pelo client.
-- Edge Functions leem via service_role (getCredentials).
CREATE POLICY integracoes_admin ON integracoes FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());


-- ===== 012_seed_playbooks.sql =====
-- 012 — playbooks iniciais (PRD v1, seção 6). Só insere se a tabela estiver vazia.
-- ICP, persona e critérios ficam vazios: são definidos por Arthur em Setup > Playbooks.

INSERT INTO playbooks (nome, descricao, icone, fontes_padrao, canais_padrao)
SELECT * FROM (VALUES
  ('Negócios locais sem presença digital', 'Para agências de marketing e web: negócios locais sem site ou presença online.', 'store',
    ARRAY['google_places'], ARRAY['whatsapp_evolution']),
  ('Decisores B2B — serviços', 'Para consultores e serviços B2B: decisores encontrados por cargo e empresa.', 'briefcase',
    ARRAY['apollo','linkedin_scraper'], ARRAY['linkedin','email']),
  ('E-commerce em crescimento', 'Para ferramentas SaaS e logística: lojas online em expansão.', 'shopping-cart',
    ARRAY['apollo'], ARRAY['email','whatsapp_evolution']),
  ('Prestadores de serviço locais', 'Para consultores generalistas: prestadores de serviço locais, validados por CNPJ.', 'wrench',
    ARRAY['google_places','cnpj'], ARRAY['whatsapp_evolution']),
  ('Criadores e infoprodutores', 'Para ferramentas de criadores: perfis encontrados no Instagram.', 'sparkles',
    ARRAY['instagram_scraper'], ARRAY['instagram','whatsapp_evolution']),
  ('Lista fria', 'Qualquer segmento: lista própria importada por CSV.', 'list',
    ARRAY['csv'], ARRAY['email','linkedin'])
) AS v(nome, descricao, icone, fontes_padrao, canais_padrao)
WHERE NOT EXISTS (SELECT 1 FROM playbooks);

-- ===== 013_metricas_resumo.sql =====
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

-- ===== 014_custos_uso.sql =====
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

-- ===== 015_source_log_realtime.sql =====
-- 015 — source_log (histórico de buscas por fonte) + Realtime para a fila, as mensagens e o pipeline.

-- Evita repetir a mesma consulta e permite rotacionar regiões/páginas entre as rodadas.
CREATE TABLE source_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campanha_id  UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  fonte        TEXT NOT NULL,
  consulta     TEXT NOT NULL,
  novos        INT NOT NULL DEFAULT 0,
  total        INT NOT NULL DEFAULT 0,
  erro         TEXT,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_log_consulta ON source_log(campanha_id, fonte, consulta, executado_em DESC);
CREATE INDEX idx_source_log_campanha_data ON source_log(campanha_id, executado_em DESC);

ALTER TABLE source_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY source_log_select ON source_log FOR SELECT TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

-- Realtime (o RLS continua valendo: cada usuário só recebe eventos do próprio workspace).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fila_acoes', 'prospect_interacoes', 'prospects'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ===== 016_supressoes_ciclo_log.sql =====
-- 016 — supressoes (lista de "não contatar") + ciclo_log (histórico das rodadas do agent-loop).

-- Quem pediu para não ser contatado (ou foi bloqueado manualmente). Vale para o workspace inteiro, em todas as campanhas.
CREATE TABLE supressoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('email', 'whatsapp', 'linkedin', 'instagram', 'dominio')),
  valor        TEXT NOT NULL,   -- normalizado: email/domínio/@ em minúsculas; whatsapp só dígitos com DDI; linkedin = slug do perfil
  motivo       TEXT,
  origem       TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'resposta' | 'importacao'
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, tipo, valor)
);
CREATE INDEX idx_supressoes_workspace ON supressoes(workspace_id);

ALTER TABLE supressoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY supressoes_ws ON supressoes FOR ALL TO authenticated
  USING (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin())
  WITH CHECK (workspace_id = ANY(get_workspace_ids_for_user()) OR is_super_admin());

-- Uma linha por rodada do agent-loop (visibilidade operacional; escrita só pela Edge Function).
CREATE TABLE ciclo_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  followup     BOOLEAN NOT NULL DEFAULT false,
  duracao_ms   INT NOT NULL DEFAULT 0,
  resumo       JSONB NOT NULL DEFAULT '{}',
  erros        INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_ciclo_log_data ON ciclo_log(executado_em DESC);

ALTER TABLE ciclo_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ciclo_log_admin ON ciclo_log FOR SELECT TO authenticated USING (is_super_admin());
