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
