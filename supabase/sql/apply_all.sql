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

-- ===== 017_integridade_entre_workspaces.sql =====
-- 017 — integridade entre workspaces.
-- Achado pelo teste de isolamento: uma linha de um workspace podia apontar (prospect_id / campanha_id) para registros
-- de OUTRO workspace. Chaves estrangeiras compostas (id, workspace_id) fecham a brecha no próprio banco, para qualquer
-- papel (inclusive service_role das Edge Functions).

ALTER TABLE campanhas ADD CONSTRAINT campanhas_id_ws_key UNIQUE (id, workspace_id);
ALTER TABLE prospects ADD CONSTRAINT prospects_id_ws_key UNIQUE (id, workspace_id);

ALTER TABLE prospects
  ADD CONSTRAINT prospects_campanha_ws_fkey FOREIGN KEY (campanha_id, workspace_id) REFERENCES campanhas (id, workspace_id);
ALTER TABLE fila_acoes
  ADD CONSTRAINT fila_acoes_prospect_ws_fkey FOREIGN KEY (prospect_id, workspace_id) REFERENCES prospects (id, workspace_id) ON DELETE CASCADE,
  ADD CONSTRAINT fila_acoes_campanha_ws_fkey FOREIGN KEY (campanha_id, workspace_id) REFERENCES campanhas (id, workspace_id);
ALTER TABLE leads_qualificados
  ADD CONSTRAINT leads_prospect_ws_fkey FOREIGN KEY (prospect_id, workspace_id) REFERENCES prospects (id, workspace_id);
ALTER TABLE fluxos_automaticos
  ADD CONSTRAINT fluxos_campanha_ws_fkey FOREIGN KEY (campanha_id, workspace_id) REFERENCES campanhas (id, workspace_id);
ALTER TABLE source_log
  ADD CONSTRAINT source_log_campanha_ws_fkey FOREIGN KEY (campanha_id, workspace_id) REFERENCES campanhas (id, workspace_id) ON DELETE CASCADE;

-- Deduplicação de mensagens recebidas por id do provedor (webhooks) e varredura de ações aprovadas.
CREATE INDEX idx_interacoes_message_id ON prospect_interacoes ((metadata ->> 'message_id')) WHERE metadata ->> 'message_id' IS NOT NULL;
CREATE INDEX idx_fila_aprovadas ON fila_acoes (criado_em) WHERE status = 'aprovada' AND executada_em IS NULL;

-- ===== 018_metricas_por_workspace.sql =====
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

-- ===== 019_playbooks_conteudo.sql =====
-- 019 — conteúdo inicial dos 6 playbooks (ICP, persona e critérios de qualificação).
-- GERADO por scripts/gerar-migration-playbooks.mjs a partir de supabase/seeds/playbooks.json. Edite o JSON, não este arquivo.
-- Só preenche playbooks cujo icp_padrao ainda está vazio: nunca sobrescreve edições feitas pela tela.
-- Os campos entre colchetes (nome, produto, segmento) são preenchidos ao criar cada campanha.

UPDATE playbooks SET
  descricao = $d$Para quem vende presença digital (sites, páginas, anúncios locais, agências de marketing e web): negócios locais encontrados no Google com pouca ou nenhuma presença online. Primeiro contato por WhatsApp. Preencha o que está entre colchetes ao criar a campanha.$d$,
  icp_padrao = $j${"segmento":"Negócios locais com pouca ou nenhuma presença digital (sem site, site desatualizado ou perfil do Google incompleto)","cargos_alvo":["Proprietário","Dono","Sócio","Gerente"],"regioes":["Brasil"],"score_minimo":50,"volume_semanal":40,"criterios_exclusao":["Franquias e redes com marketing centralizado","Negócios fechados ou sem nenhuma avaliação no Google"]}$j$::jsonb,
  persona_padrao = $j${"nome":"[Seu nome]","tom":"amigavel","produto":"[Descreva o serviço de presença digital que você vende]","argumentos":["Quem procura no Google precisa te encontrar e chamar no WhatsApp com um toque","Uma presença simples e bem feita costuma trazer pedidos de orçamento sem depender só de indicação","Sem termos técnicos: o foco é mais clientes entrando em contato"],"objecoes":[{"objecao":"Já tenho Instagram, não preciso de site","resposta":"O Instagram é ótimo para mostrar o trabalho, mas quem pesquisa no Google não encontra você por lá. Uma página simples complementa o perfil e leva a pessoa direto para o seu WhatsApp."},{"objecao":"Não tenho dinheiro para isso agora","resposta":"Entendo. Dá para começar pequeno, só com o essencial. Posso te mostrar uma opção enxuta e você decide se faz sentido agora ou mais para frente."},{"objecao":"Já tentei e não deu resultado","resposta":"Isso é comum quando o site não é pensado para gerar contato. Posso entender o que foi feito antes e dizer com sinceridade se o problema tem solução."},{"objecao":"Onde vocês conseguiram o meu contato?","resposta":"Seu contato aparece em fontes públicas de empresas do seu segmento (como o Google e redes profissionais). Se preferir não receber mais mensagens, é só me avisar que eu removo agora mesmo."}]}$j$::jsonb,
  criterios_qualificacao_padrao = $j$[{"campo":"e_decisor","pergunta":"Confirmar que a pessoa é dona ou decide sobre divulgação e investimento no negócio","obrigatorio":true},{"campo":"dor_principal","pergunta":"Entender como os clientes encontram o negócio hoje e o que falta para receber mais contatos","obrigatorio":true},{"campo":"budget","pergunta":"Saber a faixa de investimento que o negócio consideraria para melhorar a presença online","obrigatorio":false},{"campo":"timeline","pergunta":"Saber se há urgência (inauguração, alta temporada, queda de movimento)","obrigatorio":false}]$j$::jsonb
WHERE nome = $n$Negócios locais sem presença digital$n$ AND icp_padrao = '{}'::jsonb;

UPDATE playbooks SET
  descricao = $d$Para consultorias e prestadores de serviços B2B que vendem a outras empresas: decisores de empresas de serviços de 10 a 200 funcionários, encontrados pelo Apollo. O envio automático hoje é por email; o LinkedIn só recebe respostas. Preencha o que está entre colchetes ao criar a campanha.$d$,
  icp_padrao = $j${"segmento":"Empresas B2B de serviços com 10 a 200 funcionários","cargos_alvo":["Sócio-diretor","CEO","Diretor","Diretor Comercial","Head de Operações"],"regioes":["Brasil"],"score_minimo":60,"volume_semanal":30,"criterios_exclusao":["Empresas com menos de 10 funcionários","Concorrentes diretos","Órgãos públicos"]}$j$::jsonb,
  persona_padrao = $j${"nome":"[Seu nome]","tom":"consultivo","produto":"[Descreva o serviço B2B que você vende]","argumentos":["Ganho mensurável de eficiência ou receita, com o resultado esperado definido antes de começar","Projeto sob medida para a operação da empresa, não um pacote genérico","Uma conversa curta de diagnóstico para validar se existe aderência antes de qualquer proposta"],"objecoes":[{"objecao":"Já temos um fornecedor para isso","resposta":"Faz sentido. Muitas vezes o trabalho complementa o que já existe. Podemos comparar o que o fornecedor atual entrega com o que você gostaria de ter, sem trocar nada agora."},{"objecao":"Estou sem tempo agora","resposta":"Sem problema. Uma conversa de 20 minutos já basta para saber se vale aprofundar. Qual semana fica melhor?"},{"objecao":"Preciso alinhar com a diretoria ou os sócios","resposta":"Claro. Posso preparar um resumo curto para você levar à conversa interna e depois marcamos com todos, se fizer sentido."},{"objecao":"Onde vocês conseguiram o meu contato?","resposta":"Seu contato aparece em fontes públicas de empresas do seu segmento (como o Google e redes profissionais). Se preferir não receber mais mensagens, é só me avisar que eu removo agora mesmo."}]}$j$::jsonb,
  criterios_qualificacao_padrao = $j$[{"campo":"e_decisor","pergunta":"Confirmar se a pessoa decide sozinha ou com quem decide a contratação","obrigatorio":true},{"campo":"dor_principal","pergunta":"Identificar o principal gargalo ou meta que motiva a conversa","obrigatorio":true},{"campo":"budget","pergunta":"Confirmar a faixa de investimento prevista para o tema","obrigatorio":true},{"campo":"timeline","pergunta":"Confirmar o prazo desejado para começar","obrigatorio":false}]$j$::jsonb
WHERE nome = $n$Decisores B2B — serviços$n$ AND icp_padrao = '{}'::jsonb;

UPDATE playbooks SET
  descricao = $d$Para ferramentas, serviços de logística e consultorias voltados a lojas virtuais: e-commerces com operação própria e vendas recorrentes. Primeiro contato por email, com WhatsApp quando houver número validado. Preencha o que está entre colchetes ao criar a campanha.$d$,
  icp_padrao = $j${"segmento":"Lojas virtuais em crescimento, com operação própria e vendas recorrentes","cargos_alvo":["Fundador","CEO","Head de E-commerce","Gerente de Operações","Diretor de Marketing"],"regioes":["Brasil"],"score_minimo":55,"volume_semanal":30,"criterios_exclusao":["Marketplaces e grandes redes de varejo","Lojas fora do ar ou sem atividade recente"]}$j$::jsonb,
  persona_padrao = $j${"nome":"[Seu nome]","tom":"direto","produto":"[Descreva a ferramenta ou o serviço que você vende para lojas virtuais]","argumentos":["Menos trabalho manual em pedidos, atendimento e logística à medida que o volume cresce","Mais controle do que está sendo vendido e entregue, sem depender de planilhas","Implantação planejada para não parar a operação da loja"],"objecoes":[{"objecao":"Já usamos uma plataforma para isso","resposta":"Ótimo, então vocês já sentem o valor. Posso entender o que ela não resolve hoje? Se não houver ganho claro, eu mesmo digo que não vale a troca."},{"objecao":"A margem está apertada","resposta":"Por isso a conversa é sobre onde o trabalho manual ou o erro está custando dinheiro. Se não houver um ganho maior que o custo, não faz sentido seguir."},{"objecao":"Não é prioridade agora","resposta":"Entendo. Qual é a prioridade do momento? Se fizer sentido, retomo quando ela estiver resolvida."},{"objecao":"Onde vocês conseguiram o meu contato?","resposta":"Seu contato aparece em fontes públicas de empresas do seu segmento (como o Google e redes profissionais). Se preferir não receber mais mensagens, é só me avisar que eu removo agora mesmo."}]}$j$::jsonb,
  criterios_qualificacao_padrao = $j$[{"campo":"e_decisor","pergunta":"Confirmar que a pessoa decide ou influencia diretamente a contratação","obrigatorio":true},{"campo":"dor_principal","pergunta":"Entender onde o crescimento está gerando gargalo (pedidos, estoque, atendimento, entrega)","obrigatorio":true},{"campo":"budget","pergunta":"Saber a faixa de investimento prevista para resolver o gargalo","obrigatorio":false},{"campo":"timeline","pergunta":"Saber em quanto tempo precisa resolver (por exemplo, antes de uma data de pico de vendas)","obrigatorio":false}]$j$::jsonb
WHERE nome = $n$E-commerce em crescimento$n$ AND icp_padrao = '{}'::jsonb;

UPDATE playbooks SET
  descricao = $d$Para consultores generalistas e quem atende pequenos negócios: clínicas, escritórios, oficinas e estúdios locais, encontrados no Google Places (a busca por CNPJ ainda não está implementada). Primeiro contato por WhatsApp. Preencha o que está entre colchetes ao criar a campanha.$d$,
  icp_padrao = $j${"segmento":"Prestadores de serviço locais com 1 a 20 pessoas (clínicas, escritórios, oficinas, estúdios)","cargos_alvo":["Proprietário","Sócio","Dono"],"regioes":["Brasil"],"score_minimo":55,"volume_semanal":40,"criterios_exclusao":["Redes e franquias","Profissionais autônomos sem estabelecimento"]}$j$::jsonb,
  persona_padrao = $j${"nome":"[Seu nome]","tom":"consultivo","produto":"[Descreva a consultoria ou o serviço que você oferece a pequenos negócios]","argumentos":["Organizar a rotina e os processos para o dono ter mais tempo e menos improviso","Automatizar tarefas repetitivas, como agenda, cobrança e retorno de clientes","Melhorias pequenas e aplicáveis já, sem projeto longo nem ferramenta complicada"],"objecoes":[{"objecao":"Meu negócio é pequeno, isso não é para mim","resposta":"Em negócio pequeno o dono faz de tudo, e é onde o tempo mais pesa. Podemos começar por uma coisa só: a que mais te consome."},{"objecao":"Já tenho um sistema ou uma secretária para isso","resposta":"Ótimo. Então o foco não é trocar o que funciona, e sim ver se sobra alguma tarefa repetitiva que ainda toma o seu tempo."},{"objecao":"Estou sem tempo para isso agora","resposta":"Entendo, é justamente o problema que a gente resolve. Posso te chamar em outro horário, em uma conversa de 15 minutos."},{"objecao":"Onde vocês conseguiram o meu contato?","resposta":"Seu contato aparece em fontes públicas de empresas do seu segmento (como o Google e redes profissionais). Se preferir não receber mais mensagens, é só me avisar que eu removo agora mesmo."}]}$j$::jsonb,
  criterios_qualificacao_padrao = $j$[{"campo":"e_decisor","pergunta":"Confirmar que a pessoa é dona ou decide sobre contratações e melhorias","obrigatorio":true},{"campo":"dor_principal","pergunta":"Identificar a tarefa ou o processo que mais consome tempo ou gera retrabalho","obrigatorio":true},{"campo":"budget","pergunta":"Saber a faixa de investimento que o negócio consideraria","obrigatorio":false},{"campo":"timeline","pergunta":"Saber se existe urgência para resolver","obrigatorio":false}]$j$::jsonb
WHERE nome = $n$Prestadores de serviço locais$n$ AND icp_padrao = '{}'::jsonb;

UPDATE playbooks SET
  descricao = $d$Para ferramentas e serviços voltados a criadores de conteúdo e infoprodutores, encontrados no Instagram. Atenção: a Meta não permite a primeira mensagem por Instagram. O contato inicial acontece por WhatsApp (se houver número validado) ou por email, e o Instagram só responde a quem escreveu. Preencha o que está entre colchetes ao criar a campanha.$d$,
  icp_padrao = $j${"segmento":"Criadores de conteúdo e infoprodutores com audiência e produto próprio (curso, mentoria, comunidade)","cargos_alvo":["Criador","Fundador","Produtor de infoproduto","Mentor"],"regioes":["Brasil"],"score_minimo":50,"volume_semanal":30,"criterios_exclusao":["Perfis sem produto ou serviço próprio","Contas inativas há mais de 3 meses"]}$j$::jsonb,
  persona_padrao = $j${"nome":"[Seu nome]","tom":"amigavel","produto":"[Descreva a ferramenta ou o serviço que você vende para criadores]","argumentos":["Mais tempo para criar e menos tempo em tarefas operacionais","Vendas, atendimento e entrega do produto organizados em um só lugar","Crescer a audiência e converter melhor sem aumentar a equipe"],"objecoes":[{"objecao":"Faço tudo sozinho e dá certo","resposta":"Funciona enquanto o volume é pequeno. A ideia é justamente não travar quando a audiência crescer. Posso mostrar só a parte que mais te toma tempo."},{"objecao":"Não tenho verba para ferramentas agora","resposta":"Entendo. Dá para começar pelo essencial e crescer junto com o faturamento. Posso te mostrar o que traz retorno mais rápido."},{"objecao":"Já testei ferramentas parecidas e larguei","resposta":"Acontece muito quando a ferramenta pede mais trabalho do que poupa. Me conta o que não funcionou e eu digo com franqueza se aqui seria diferente."},{"objecao":"Onde vocês conseguiram o meu contato?","resposta":"Seu contato aparece em fontes públicas de empresas do seu segmento (como o Google e redes profissionais). Se preferir não receber mais mensagens, é só me avisar que eu removo agora mesmo."}]}$j$::jsonb,
  criterios_qualificacao_padrao = $j$[{"campo":"e_decisor","pergunta":"Confirmar que a pessoa decide sobre as ferramentas e os gastos do negócio","obrigatorio":true},{"campo":"dor_principal","pergunta":"Entender o que mais atrapalha hoje: vendas, atendimento, entrega ou produção de conteúdo","obrigatorio":true},{"campo":"budget","pergunta":"Saber a faixa de investimento mensal que faria sentido","obrigatorio":false},{"campo":"timeline","pergunta":"Saber se há um lançamento ou data importante próxima","obrigatorio":false}]$j$::jsonb
WHERE nome = $n$Criadores e infoprodutores$n$ AND icp_padrao = '{}'::jsonb;

UPDATE playbooks SET
  descricao = $d$Para listas próprias importadas por CSV, de qualquer segmento. O ICP e a persona precisam ser ajustados para a lista em questão. Contato por email, com WhatsApp quando houver número. Preencha o que está entre colchetes ao criar a campanha.$d$,
  icp_padrao = $j${"segmento":"[Defina o segmento ou o perfil desta lista]","cargos_alvo":[],"regioes":["Brasil"],"score_minimo":40,"volume_semanal":100,"criterios_exclusao":["Contatos sem email nem WhatsApp válido","Clientes atuais"]}$j$::jsonb,
  persona_padrao = $j${"nome":"[Seu nome]","tom":"consultivo","produto":"[Descreva o que você vende]","argumentos":["[Principal benefício para o público desta lista]"],"objecoes":[{"objecao":"Já tenho um fornecedor para isso","resposta":"Faz sentido. Se quiser, comparo o que você tem hoje com o que eu ofereço, sem compromisso de trocar nada."},{"objecao":"Não é o momento","resposta":"Sem problema. Posso retomar mais para frente, em uma data que seja melhor para você?"},{"objecao":"Onde vocês conseguiram o meu contato?","resposta":"Seu contato aparece em fontes públicas de empresas do seu segmento (como o Google e redes profissionais). Se preferir não receber mais mensagens, é só me avisar que eu removo agora mesmo."}]}$j$::jsonb,
  criterios_qualificacao_padrao = $j$[{"campo":"e_decisor","pergunta":"Confirmar que a pessoa decide ou influencia a contratação","obrigatorio":true},{"campo":"dor_principal","pergunta":"Identificar o principal problema ou meta que motiva a conversa","obrigatorio":true},{"campo":"budget","pergunta":"Saber a faixa de investimento prevista","obrigatorio":false},{"campo":"timeline","pergunta":"Saber o prazo desejado","obrigatorio":false}]$j$::jsonb
WHERE nome = $n$Lista fria$n$ AND icp_padrao = '{}'::jsonb;

-- ===== 020_notificacoes_alertas_metricas.sql =====
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

-- ===== 021_resumo_operacional.sql =====
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

-- 022 — credenciais só entram pela função integration-save (que as criptografa)
-- O painel continua LENDO (vê apenas texto cifrado) e REMOVENDO integrações; inserir e alterar passa a ser exclusivo da função (service_role).

DROP POLICY IF EXISTS integracoes_admin ON integracoes;

CREATE POLICY integracoes_select ON integracoes FOR SELECT TO authenticated
  USING (is_super_admin());

CREATE POLICY integracoes_delete ON integracoes FOR DELETE TO authenticated
  USING (is_super_admin());
