-- Teste da função telefone_canonico (migration 025). Mesma tabela de casos de supabase/functions/_shared/telefone.test.ts (contrato Maestro ↔ CRM).
-- Só leitura: devolve as linhas que FALHARAM (lista vazia = tudo certo).
WITH casos(entrada, esperado) AS (
  VALUES
    ('(11) 98765-4321', '5511987654321'),
    ('11987654321', '5511987654321'),
    ('+55 11 98765-4321', '5511987654321'),
    ('5511987654321', '5511987654321'),
    ('551187654321', '5511987654321'),
    ('1187654321', '5511987654321'),
    ('55 (11) 8765-4321', '5511987654321'),
    ('(11) 3456-7890', '551134567890'),
    ('551134567890', '551134567890'),
    ('0 11 98765-4321', '5511987654321'),
    ('005511987654321', '5511987654321'),
    ('55 55 98765-4321', '5555987654321'),
    ('55987654321', '5555987654321'),
    ('5511987654321@s.whatsapp.net', '5511987654321'),
    ('551187654321@s.whatsapp.net', '5511987654321'),
    ('+1 415 555 2671', '14155552671'),
    ('98765-4321', NULL),
    ('12345', NULL),
    ('', NULL),
    ('5511987654321:12@s.whatsapp.net', '5511987654321'),
    (NULL, NULL),
    ('abc', NULL)
)
SELECT count(*) AS casos,
       count(*) FILTER (WHERE telefone_canonico(entrada) IS DISTINCT FROM esperado) AS falhas,
       coalesce(jsonb_agg(jsonb_build_object('entrada', entrada, 'esperado', esperado, 'obtido', telefone_canonico(entrada)))
                FILTER (WHERE telefone_canonico(entrada) IS DISTINCT FROM esperado), '[]'::jsonb) AS detalhes
FROM casos;
