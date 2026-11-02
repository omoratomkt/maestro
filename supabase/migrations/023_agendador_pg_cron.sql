-- 023: agendador do ciclo dentro do Supabase (pg_cron + pg_net)
-- Motivo: o agendamento do GitHub Actions dispara o agent-loop a cada 3 a 7 horas, não a cada 15 minutos.
-- O pg_cron roda no horário e chama a Edge Function agent-loop com o mesmo cabeçalho x-cron-secret.
-- O segredo NÃO fica nesta migration: ele é lido do Vault (nome: cron_secret), gravado à parte pelo operador.
-- O GitHub Actions continua como reserva e o watchdog segue vigiando.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Ciclo normal: a cada 15 minutos, todos os dias.
SELECT cron.schedule(
  'agent-loop-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://qexigmtnezgbmmkqneei.supabase.co/functions/v1/agent-loop',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

-- Follow-up: 9h e 14h (Brasília) de segunda a sexta = 12h e 17h UTC.
SELECT cron.schedule(
  'agent-loop-followup',
  '0 12,17 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://qexigmtnezgbmmkqneei.supabase.co/functions/v1/agent-loop',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := '{"followup": true}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

-- Limpeza do histórico do próprio agendador (fica 7 dias), para a tabela não crescer sem fim.
SELECT cron.schedule(
  'limpar-historico-cron',
  '30 3 * * *',
  $$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'; $$
);
