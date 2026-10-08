# Maestro

Prospecção outbound autônoma com sequenciador inteligente de IA. Um agente lê os sinais de cada prospect em todos os
canais (respostas, silêncio, tempo, canal de engajamento) e decide o próximo passo; toda ação passa pela **fila de
supervisão** antes de sair, até o operador promover um padrão para execução automática.

- **Frontend:** React 18 + Vite + TypeScript + shadcn/ui (`src/`), publicado na Vercel a cada push em `main`.
- **Backend:** Supabase (Postgres + RLS + Edge Functions em Deno) — `supabase/`.
- **Orquestração:** GitHub Actions (`.github/workflows/`) chama o `agent-loop` a cada 15 min.
- **IA:** Claude Haiku 4.5 (triagem, qualificação, aderência ao ICP) e Sonnet 5.5 (decisão/mensagens e briefing).

## Como o ciclo funciona

```
CSV / source-search ─► prospects (novo)
                          │  agent-loop (cron 15 min)
                          ▼
              prospect-enrich: site, CNPJ, WhatsApp, email → score 0–100
                          │  abaixo do mínimo da campanha → descartado
                          ▼
        agente decide ─► fila_acoes (pendente) ──► operador aprova ──► action-execute ──► canal
                  ▲                                                                         │
                  └── webhook-* (resposta) ◄── triagem (Haiku) ◄── qualificação ◄────────────┘
                                                        │ critérios obrigatórios ok
                                                        ▼
                                       leads_qualificados + briefing (Sonnet) + webhook para o CRM
```

Cada chamada à IA grava tokens e custo em `custos_uso` (alimenta "custo por lead qualificado" em Métricas).

## Edge Functions

| Função | Autenticação | O que faz |
|---|---|---|
| `agent-loop` | `x-cron-secret` | Ciclo do agente (expira, enriquece, envia aprovadas, decide). `followup=true` prioriza silêncio longo. |
| `action-execute` | JWT do usuário (RLS) | Envia uma ação aprovada pelo canal certo. |
| `prospect-enrich` | JWT do usuário (RLS) | Enriquece e pontua um prospect. |
| `prospect-qualify` | JWT do usuário (RLS) | Verifica os critérios obrigatórios da campanha. |
| `generate-briefing` | JWT do usuário (RLS) | Briefing do lead + aviso ao CRM. |
| `source-search` | JWT do usuário (RLS) | Busca prospects (hoje: Google Places). |
| `webhook-whatsapp` / `-email` / `-linkedin` / `-instagram` | `?ws=<workspace>&token=<webhook_secret>` | Recebem respostas dos canais. |

Funções com JWT usam o RLS do próprio usuário como autorização antes de agir com `service_role`.

## Canais: o que existe de verdade

| Canal | Enviar | Receber |
|---|---|---|
| WhatsApp — Evolution API | sim | sim (`MESSAGES_UPSERT`/`UPDATE`) |
| WhatsApp — Meta Cloud API | sim (texto; fora de 24h exige template) | sim |
| Email — Instantly | 1º email via lead na campanha (corpo `{{personalization}}`); respostas via `/emails/reply` | sim (`reply_received`) |
| LinkedIn (Expandi/Dripify) | **não**: sem envio avulso por API | sim (formato genérico) |
| Instagram DM | **não**: a Meta só permite responder a quem já escreveu | parcial |

O agente só propõe canais com integração ativa **e** envio implementado.

## Operação

1. **Segredos** (nunca no repositório): credenciais ficam em `integracoes` (Setup → Integrações); o `CRON_SECRET` fica
   nos *secrets* das Edge Functions e do GitHub Actions (junto com `SUPABASE_URL`).
2. **Webhooks:** em Setup → Integrações, "Gerar" cria o segredo e o formulário mostra a URL pronta para colar no provedor.
3. **Migrations:** `supabase/migrations/` em ordem numérica; `supabase/sql/apply_all.sql` reúne todas.
4. **Deploy das funções:** `supabase functions deploy <nome> --project-ref <ref> --use-api` (`--no-verify-jwt` para
   `agent-loop` e `webhook-*`).
5. **Testes:** `deno test --allow-env --config supabase/functions/deno.json supabase/functions/_shared/`.
6. **Dados de demonstração:** `supabase/sql/demo_seed.sql` / `demo_cleanup.sql`. Prospects com `fonte = 'demo'` nunca são
   enriquecidos nem contatados, e aprovar uma ação deles **simula** o envio.
7. **Tipos do banco:** `npm run types` (requer `SUPABASE_ACCESS_TOKEN`).

> Repositórios públicos têm os agendamentos do GitHub Actions desativados após 60 dias sem atividade; um commit reativa.
