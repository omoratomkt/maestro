-- 011 — RLS em todas as tabelas
-- service_role ignora RLS (Edge Functions). authenticated acessa só o próprio workspace.

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

-- Helpers (SECURITY DEFINER evita recursão de RLS em workspace_usuarios)
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

-- workspaces: membro lê o seu; super_admin gerencia todos
CREATE POLICY workspaces_select ON workspaces FOR SELECT TO authenticated
  USING (id = ANY(get_workspace_ids_for_user()) OR is_super_admin());
CREATE POLICY workspaces_admin ON workspaces FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- workspace_usuarios: usuário vê as próprias linhas; super_admin gerencia tudo
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

-- integracoes guarda credenciais: só super_admin acessa pelo client.
-- Edge Functions leem via service_role (getCredentials).
CREATE POLICY integracoes_admin ON integracoes FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());
