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
| `source-search` | JWT do usuário (RLS) | Busca prospects nas fontes da campanha (Google Places, Apollo, Instagram e LinkedIn via Apify). Roda ao lançar a campanha, no botão "Buscar agora" e 1x por dia pelo `agent-loop`. |
| `admin-users` | JWT de super_admin | Lista, convida (email), troca o papel e remove usuários de um workspace. |
| `webhook-calcom` | `?ws=` + assinatura HMAC | Reflete agendamentos do Cal.com no lead e no pipeline (criado, remarcado, cancelado). |
| `webhook-lead` | `?ws=&token=` | Fonte "inbound": formulários e automações (Zapier/Make) criam prospects. |
| `health-check` | `x-cron-secret` | Vigia: responde 503 se o agent-loop parou, falha em série ou há envios travados. O workflow `watchdog` o chama a cada 30 min e o GitHub avisa por email quando falha. |
| `webhook-whatsapp` / `-email` / `-linkedin` / `-instagram` | `?ws=<workspace>&token=<webhook_secret>` | Recebem respostas dos canais. |

Funções com JWT usam o RLS do próprio usuário como autorização antes de agir com `service_role`.

## Canais: o que existe de verdade

| Canal | Enviar | Receber |
|---|---|---|
| WhatsApp — Evolution API | sim | sim (`MESSAGES_UPSERT`/`UPDATE`) |
| WhatsApp — Meta Cloud API | sim (texto; fora de 24h exige template) | sim |
| Email — Instantly | 1º email via lead na campanha (corpo `{{personalization}}`); respostas via `/emails/reply` | sim (`reply_received`) |
| LinkedIn (Expandi/Dripify) | **não**: sem envio avulso por API | sim (formato genérico) |
| Instagram DM | só **responder** a quem escreveu (IGSID, janela de 24 h) | sim (o @ é resolvido pela Graph API) |

O agente só propõe canais com integração ativa **e** envio possível naquele momento.

## Fontes de prospects

| Fonte | Situação |
|---|---|
| Google Places | busca por segmento × cidade; "Brasil" rotaciona pelas 27 capitais; consultas não se repetem por 7 dias (`source_log`) |
| Apollo | busca grátis + `people/match` (1 crédito por pessoa aproveitada, até 15 por rodada); cada rodada avança uma página |
| Instagram (Apify) | ator `apify/instagram-scraper` por padrão; ator e entrada configuráveis |
| LinkedIn (Apify) | ator e entrada **definidos por você** na integração; o scraping viola os Termos do LinkedIn |
| CSV | importação em Pipeline → Importar CSV |
| Inbound | `webhook-lead` |
| CNPJ (Receita) | **não implementada**: a Receita não busca por atividade e cidade; falta escolher um provedor |

A cota semanal da campanha (`volume_semanal`) vale para todas as fontes somadas.

## Vários clientes (workspaces)

Cada cliente é um workspace e o painel mostra um de cada vez: quem tem acesso a mais de um (super_admin vê todos) troca pelo seletor no topo da barra lateral. Campanhas, pipeline, fila, caixa de entrada, automações, métricas e dashboard filtram pelo workspace ativo. As chaves estrangeiras compostas (migration 017) impedem que uma linha de um workspace aponte para dados de outro.

## Direitos do titular (LGPD)

Em Pipeline → prospect: **Baixar dados (JSON)** e **Excluir prospect** (apaga mensagens, estado, ações e lead; por padrão adiciona o contato à lista de supressão para ele não voltar). Pedidos de "pare de me contatar" recebidos por mensagem entram sozinhos na lista.

## Operação

1. **Segredos** (nunca no repositório): credenciais ficam em `integracoes` (Setup → Integrações); o `CRON_SECRET` fica
   nos *secrets* das Edge Functions e do GitHub Actions (junto com `SUPABASE_URL`).
2. **Webhooks:** em Setup → Integrações, "Gerar" cria o segredo e o formulário mostra a URL pronta para colar no provedor.
3. **Migrations:** `supabase/migrations/` em ordem numérica; `supabase/sql/apply_all.sql` reúne todas.
4. **Deploy das funções:** `supabase functions deploy <nome> --project-ref <ref> --use-api` (`--no-verify-jwt` para
   `agent-loop` e `webhook-*`).
5. **Testes e verificações:**
   - `npm test` (Vitest: CSV, lista de supressão, wizard, catálogo de integrações) e `npm run check:api` (as consultas do app com junções ainda são aceitas pela API; roda no CI).
   - **Isolamento entre clientes (RLS):** `SUPABASE_ACCESS_TOKEN=... node scripts/teste-isolamento-rls.mjs` (50 verificações, numa transação com ROLLBACK). Rode depois de **toda** migration.
   - Funções: `deno test --allow-env --config supabase/functions/deno.json supabase/functions/_shared/` (horário comercial, contrato da API do Claude, contratos de Google Places, Apollo e Apify).
   Convites e recuperação de senha dependem de **Authentication → URL Configuration** no Supabase: Site URL = URL do app e a mesma URL (`/definir-senha`) na lista de Redirect URLs.
6. **Dados de demonstração:** `supabase/sql/demo_seed.sql` / `demo_cleanup.sql`. Prospects com `fonte = 'demo'` nunca são
   enriquecidos nem contatados, e aprovar uma ação deles **simula** o envio.
7. **Tipos do banco:** `npm run types` (requer `SUPABASE_ACCESS_TOKEN`).

> Repositórios públicos têm os agendamentos do GitHub Actions desativados após 60 dias sem atividade; um commit reativa.
