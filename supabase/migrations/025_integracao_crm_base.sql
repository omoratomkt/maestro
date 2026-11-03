-- 025: base da integração com o CRM (etapa A, não depende do CRM)
--  1) telefone_canonico(): mesma regra do TypeScript (_shared/telefone.ts) e do CRM. Só para COMPARAR contatos.
--  2) prospects.whatsapp_normalizado: coluna nova, mantida por gatilho. O número original (o que a Evolution validou e é usado para enviar) NÃO é alterado.
--  3) eventos_recebidos: registro durável de tudo o que chega nos webhooks, gravado ANTES de processar, com fila de reprocessamento.
-- Só aditiva. Escrita em eventos_recebidos apenas pelas Edge Functions (service_role): nenhuma política para usuários.

-- ───────────────────────────── 1) telefone canônico
-- Regras (contrato Maestro ↔ CRM): só dígitos; tira 00 ou 0 inicial; 10 ou 11 dígitos = sem DDI (recebe 55); 12 ou 13 começando em 55 = com DDI.
-- Depois do DDD: 8 dígitos começando em 6 a 9 = celular, recebe o 9; começando em 2 a 5 = fixo; 9 dígitos precisam começar em 9.
-- "+" com DDI diferente de 55 fica como veio. Sufixo de JID do WhatsApp (@s.whatsapp.net, :12@...) é ignorado. Qualquer outro caso: NULL.
CREATE OR REPLACE FUNCTION telefone_canonico(raw TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  s TEXT;
  d TEXT;
  internacional BOOLEAN;
  nacional TEXT;
  ddd TEXT;
  numero TEXT;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  s := split_part(split_part(btrim(raw), '@', 1), ':', 1);
  internacional := left(s, 1) = '+';
  d := regexp_replace(s, '\D', '', 'g');
  IF d = '' THEN RETURN NULL; END IF;
  IF left(d, 2) = '00' THEN d := substr(d, 3);
  ELSIF left(d, 1) = '0' THEN d := substr(d, 2);
  END IF;
  IF d = '' THEN RETURN NULL; END IF;
  IF internacional AND left(d, 2) <> '55' THEN RETURN d; END IF;

  IF length(d) IN (10, 11) THEN
    nacional := d;
  ELSIF length(d) IN (12, 13) AND left(d, 2) = '55' THEN
    nacional := substr(d, 3);
  ELSE
    RETURN NULL;
  END IF;

  ddd := left(nacional, 2);
  numero := substr(nacional, 3);
  IF ddd !~ '^[1-9][0-9]$' THEN RETURN NULL; END IF;
  IF length(numero) = 8 THEN
    IF numero ~ '^[6-9]' THEN numero := '9' || numero;
    ELSIF numero !~ '^[2-5]' THEN RETURN NULL;
    END IF;
  ELSIF length(numero) = 9 THEN
    IF left(numero, 1) <> '9' THEN RETURN NULL; END IF;
  ELSE
    RETURN NULL;
  END IF;
  RETURN '55' || ddd || numero;
END $$;

-- ───────────────────────────── 2) coluna normalizada em prospects
ALTER TABLE prospects ADD COLUMN whatsapp_normalizado TEXT;

CREATE OR REPLACE FUNCTION _trg_prospects_whatsapp_normalizado() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.whatsapp_normalizado := telefone_canonico(NEW.whatsapp);
  RETURN NEW;
END $$;
CREATE TRIGGER prospects_whatsapp_normalizado BEFORE INSERT OR UPDATE OF whatsapp ON prospects
  FOR EACH ROW EXECUTE FUNCTION _trg_prospects_whatsapp_normalizado();

UPDATE prospects SET whatsapp_normalizado = telefone_canonico(whatsapp) WHERE whatsapp IS NOT NULL;
CREATE INDEX idx_prospects_whatsapp_normalizado ON prospects (workspace_id, whatsapp_normalizado) WHERE whatsapp_normalizado IS NOT NULL;

-- ───────────────────────────── 3) registro durável do que chega nos webhooks
-- Gravado antes de qualquer processamento. O corpo fica enquanto o evento não foi concluído (para reprocessar) e é apagado ao concluir;
-- a linha (sem o corpo) fica 7 dias só para auditoria do que chegou e do resultado.
CREATE TABLE eventos_recebidos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canal                TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email', 'linkedin', 'instagram')),
  corpo_bruto          TEXT,  -- exatamente o que o provedor enviou; NULL depois de concluído
  status               TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processado', 'erro', 'falhou')),
  resultado            TEXT,  -- ex.: 'processado', 'sem_prospect', 'duplicada', 'status_de_entrega'
  tentativas           INTEGER NOT NULL DEFAULT 0,
  proxima_tentativa_em TIMESTAMPTZ NOT NULL DEFAULT now() + interval '5 minutes',  -- dá tempo do processamento normal terminar antes do reprocesso
  erro                 TEXT,
  recebido_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  processado_em        TIMESTAMPTZ
);
CREATE INDEX idx_eventos_recebidos_fila ON eventos_recebidos (proxima_tentativa_em) WHERE status IN ('pendente', 'erro');
CREATE INDEX idx_eventos_recebidos_ws ON eventos_recebidos (workspace_id, recebido_em DESC);
ALTER TABLE eventos_recebidos ENABLE ROW LEVEL SECURITY;  -- sem policies: nenhum usuário lê ou escreve; a service_role ignora o RLS

SELECT cron.schedule('limpar-eventos-recebidos', '55 3 * * *', $$ DELETE FROM eventos_recebidos WHERE recebido_em < now() - interval '7 days'; $$);
