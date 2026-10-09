// deno-lint-ignore-file no-explicit-any
// agent-loop — o ciclo do agente. Chamado pelo GitHub Actions a cada 15 min (e 2x/dia com followup=true).
//
// Em cada rodada, nesta ordem:
//   1. expira ações pendentes vencidas (o prospect volta para a fila de decisão do agente)
//   1b. busca novos prospects nas fontes (1x por dia por campanha ativa, dentro da cota semanal)
//   2. enriquece prospects novos (score de ICP; abaixo do mínimo são descartados)
//   3. envia ações aprovadas que ainda não foram enviadas
//   4. para cada prospect com proxima_acao_em <= agora: o agente decide e propõe a próxima ação
//
// POST { followup?: boolean, limit?: number }  ·  Auth: header x-cron-secret (ou service_role).
import { proposeNextAction } from '../_shared/agent.ts'
import { enrichProspect } from '../_shared/enrich.ts'
import { ERRO_LIMITE, executeAction } from '../_shared/execute.ts'
import { enviarResumosDiarios, snapshotMetricas } from '../_shared/rotinas.ts'
import { runSources } from '../_shared/sources.ts'
import { corsHeaders, errMessage, isCronAuthorized, json, readJson, serviceClient } from '../_shared/util.ts'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
// Intervalo aleatório entre WhatsApps seguidos: rajadas idênticas são o que derruba contas de API não oficial.
const jitter = (canal?: string) => (canal === 'whatsapp' ? sleep(2000 + Math.random() * 4000) : Promise.resolve())

const TIME_BUDGET_MS = 110_000 // o limite da Edge Function é 150 s
const SILENCIO_FOLLOWUP_H = 48

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  if (!isCronAuthorized(req)) return json({ error: 'Não autorizado' }, 401)

  const body = (await readJson(req)) ?? {}
  const followup = Boolean(body.followup)
  const limit = Math.min(Number(body.limit) || 25, 100)
  const started = Date.now()
  const timeLeft = () => TIME_BUDGET_MS - (Date.now() - started) > 0
  const sb = serviceClient()
  const report: Record<string, any> = { followup, expiradas: 0, buscas: [], enriquecidos: [], enviadas: [], decisoes: [], erros: [] }
  const nowIso = () => new Date().toISOString()

  // 1) Expirar pendentes vencidas
  const { data: expiradas } = await sb
    .from('fila_acoes')
    .update({ status: 'expirada' })
    .eq('status', 'pendente')
    .lt('expira_em', nowIso())
    .select('prospect_id')
  report.expiradas = expiradas?.length ?? 0
  for (const e of expiradas ?? []) {
    await sb.from('prospect_estado').upsert({ prospect_id: e.prospect_id, aguardando: 'tempo', proxima_acao_em: nowIso(), atualizado_em: nowIso() }, { onConflict: 'prospect_id' })
  }

  // 1b) Buscar prospects: 1x por dia por campanha ativa (nunca nas de demonstração), no máximo 2 campanhas por rodada
  const { data: ativas } = await sb.from('campanhas').select('*').eq('status', 'ativa').not('nome', 'like', '[DEMO]%')
  const desdeBusca = new Date(Date.now() - 20 * 3600e3).toISOString()
  let buscou = 0
  for (const c of ativas ?? []) {
    if (buscou >= 2 || !timeLeft()) break
    const { data: recente } = await sb.from('source_log').select('id').eq('campanha_id', c.id).gte('executado_em', desdeBusca).limit(1)
    if (recente?.length) continue
    try {
      const r = await runSources(sb, c)
      report.buscas.push({ campanha_id: c.id, inseridos: r.inseridos, fontes: r.fontes })
      buscou++
      // Sem nada a buscar (sem fontes executáveis ou cota cheia) não deixa rastro em source_log: marca a checagem.
      if (!r.inseridos) await sb.from('source_log').insert({ workspace_id: c.workspace_id, campanha_id: c.id, fonte: 'verificacao', consulta: 'ciclo diário sem novos', novos: 0, total: 0 })
    } catch (e) {
      report.erros.push({ etapa: 'buscar', campanha_id: c.id, erro: errMessage(e) })
    }
  }

  // 1c) Rotinas periódicas: resumo diário por email e foto horária das métricas
  report.resumos = await enviarResumosDiarios(sb).catch((e) => ({ erro: errMessage(e) }))
  report.snapshot = await snapshotMetricas(sb).catch((e) => `erro: ${errMessage(e)}`)

  // 2) Enriquecer novos (campanhas ativas)
  const idsAtivas = (ativas ?? []).map((c: any) => c.id)
  if (idsAtivas.length) {
    const { data: novos } = await sb
      .from('prospects')
      .select('id')
      .is('enriched_at', null)
      .eq('status', 'novo')
      .or('fonte.is.null,fonte.neq.demo')
      .in('campanha_id', idsAtivas)
      .order('criado_em')
      .limit(10)
    for (const n of novos ?? []) {
      if (!timeLeft()) break
      try {
        const r = await enrichProspect(sb, n.id)
        report.enriquecidos.push({ prospect_id: n.id, score: r.score, status: r.status })
      } catch (e) {
        report.erros.push({ etapa: 'enriquecer', prospect_id: n.id, erro: errMessage(e) })
        // Marca como tentado para não travar a fila: reprocessar manualmente via prospect-enrich.
        await sb.from('prospects').update({ enriched_at: nowIso() }).eq('id', n.id)
      }
    }
  }

  // 3) Enviar aprovadas pendentes de envio (sem erro anterior; reenvios são manuais)
  const { data: aprovadas } = await sb
    .from('fila_acoes')
    .select('id')
    .eq('status', 'aprovada')
    .is('executada_em', null)
    .or(`erro_execucao.is.null,erro_execucao.like.${ERRO_LIMITE}*`)
    .limit(20)
  for (const a of aprovadas ?? []) {
    if (!timeLeft()) break
    const r = await executeAction(sb, a.id)
    report.enviadas.push({ fila_id: a.id, ok: r.ok, detalhe: r.detalhe })
    if (r.ok) await jitter(r.canal)
  }

  // 4) Decisões do agente
  const { data: devidos } = await sb
    .from('prospect_estado')
    .select('id, prospect_id, proxima_acao_em, aguardando')
    .not('proxima_acao_em', 'is', null)
    .lte('proxima_acao_em', nowIso())
    .order('proxima_acao_em')
    .limit(limit * (followup ? 3 : 1))

  let candidatos = devidos ?? []
  if (followup && candidatos.length) {
    // Prioriza quem está em silêncio longo.
    const corte = Date.now() - SILENCIO_FOLLOWUP_H * 3600e3
    const { data: ps } = await sb.from('prospects').select('id, ultima_interacao_em').in('id', candidatos.map((c: any) => c.prospect_id))
    const silencio = new Set((ps ?? []).filter((p: any) => !p.ultima_interacao_em || new Date(p.ultima_interacao_em).getTime() < corte).map((p: any) => p.id))
    candidatos = candidatos.filter((c: any) => silencio.has(c.prospect_id)).slice(0, limit)
  }

  for (const c of candidatos) {
    if (!timeLeft()) break
    // Claim otimista: empurra a próxima checagem 30 min para frente; se outra rodada pegou antes, ninguém duplica.
    const { data: claimed } = await sb
      .from('prospect_estado')
      .update({ proxima_acao_em: new Date(Date.now() + 30 * 60e3).toISOString() })
      .eq('id', c.id)
      .eq('proxima_acao_em', c.proxima_acao_em)
      .select('id')
      .maybeSingle()
    if (!claimed) continue

    try {
      const o = await proposeNextAction(sb, c.prospect_id, { followup })
      report.decisoes.push({ prospect_id: c.prospect_id, ...o })
      if (o.resultado === 'automatica') {
        const r = await executeAction(sb, o.fila_id)
        report.enviadas.push({ fila_id: o.fila_id, ok: r.ok, detalhe: r.detalhe })
        if (r.ok) await jitter(r.canal)
      }
      // Nada decidido a seguir (ignorado): sem este reset o claim acima seguraria o prospect por 30 min à toa.
      if (o.resultado === 'ignorado') {
        // Demonstração nunca volta à fila; os demais voltam a ser olhados em 6 h.
        const proxima = o.motivo.startsWith('demo') ? null : new Date(Date.now() + 6 * 3600e3).toISOString()
        await sb.from('prospect_estado').update({ proxima_acao_em: proxima }).eq('id', c.id)
      }
    } catch (e) {
      report.erros.push({ etapa: 'decidir', prospect_id: c.prospect_id, erro: errMessage(e) })
      await sb.from('prospect_estado').update({ proxima_acao_em: new Date(Date.now() + 3600e3).toISOString() }).eq('id', c.id)
    }
  }

  report.duracao_ms = Date.now() - started

  // Histórico da rodada (tela Setup → visão geral). Nunca derruba a resposta se falhar.
  await sb
    .from('ciclo_log')
    .insert({
      followup,
      duracao_ms: report.duracao_ms,
      erros: report.erros.length,
      resumo: {
        expiradas: report.expiradas,
        buscas: report.buscas.length,
        inseridos: report.buscas.reduce((n: number, b: any) => n + (b.inseridos ?? 0), 0),
        enriquecidos: report.enriquecidos.length,
        enviadas: report.enviadas.filter((e: any) => e.ok).length,
        decisoes: report.decisoes.length,
        erros: report.erros.slice(0, 20),
      },
    })
    .then(() => {}, () => {})
  await sb.from('ciclo_log').delete().lt('executado_em', new Date(Date.now() - 30 * 24 * 3600e3).toISOString()).then(() => {}, () => {})

  return json(report)
})
