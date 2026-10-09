-- 022 — credenciais só entram pela função integration-save (que as criptografa)
-- O painel continua LENDO (vê apenas texto cifrado) e REMOVENDO integrações; inserir e alterar passa a ser exclusivo da função (service_role).

DROP POLICY IF EXISTS integracoes_admin ON integracoes;

CREATE POLICY integracoes_select ON integracoes FOR SELECT TO authenticated
  USING (is_super_admin());

CREATE POLICY integracoes_delete ON integracoes FOR DELETE TO authenticated
  USING (is_super_admin());
