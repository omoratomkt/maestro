// deno-lint-ignore-file no-explicit-any
// Registro durável do que chega nos webhooks.
//   1. o webhook GRAVA o evento (corpo bruto) antes de qualquer processamento; se não conseguir gravar, responde erro e o provedor reenvia;
//   2. processa em segundo plano e marca o resultado (o corpo é apagado ao concluir);
//   3. o que falhar ou ficar parado (função derrubada no meio) é reprocessado pelo agent-loop, com espera crescente, até MAX_TENTATIVAS;
//   4. esgotadas as tentativas o evento vira "falhou" e o operador é avisado por email: nenhuma mensagem some em silêncio.
import { notificar } from './notify.ts'
import { processarEvento, type CanalDeEvento } from './processadores.ts'
import { errMessage, type SB } from './util.ts'

export const MAX_TENTATIVAS = 5
/** Espera antes da tentativa seguinte, em minutos, conforme as tentativas já feitas (1ª falha → 5 min, 2ª → 15, ...). */
export const esperaMinutos = (tentativasFeitas: number) => 5 * 3 ** Math.max(0, tentativasFeitas - 1)

export interface EventoRecebido {
  id: string
  workspace_id: string
  canal: CanalDeEvento
  corpo_bruto: string | null
  tentativas: number
}

/** Grava o evento antes de processar. Lança se não gravar: o webhook deve responder erro (o provedor reenvia). */
export async function registrarEvento(sb: SB, workspace_id: string, canal: CanalDeEvento, corpo: string): Promise<EventoRecebido> {
  const { data, error } = await sb.from('eventos_recebidos').insert({ workspace_id, canal, corpo_bruto: corpo }).select('id').single()
  if (error || !data) throw new Error(`Falha ao registrar o evento recebido: ${error?.message ?? 'sem retorno'}`)
  return { id: data.id, workspace_id, canal, corpo_bruto: corpo, tentativas: 0 }
}

/** Processa um evento já gravado e marca o resultado. Nunca lança. `tentativas` = quantas já foram feitas, contando esta. */
export async function executarEvento(sb: SB, ev: EventoRecebido, opts: { retomar?: boolean } = {}): Promise<'processado' | 'erro' | 'falhou'> {
  const tentativas = Math.max(ev.tentativas, 1)
  try {
    const resultado = await processarEvento(sb, ev.workspace_id, ev.canal, ev.corpo_bruto, { retomar: opts.retomar })
    await sb
      .from('eventos_recebidos')
      .update({ status: 'processado', resultado, corpo_bruto: null, erro: null, tentativas, processado_em: new Date().toISOString() })
      .eq('id', ev.id)
    return 'processado'
  } catch (e) {
    const esgotou = tentativas >= MAX_TENTATIVAS
    await sb
      .from('eventos_recebidos')
      .update({
        status: esgotou ? 'falhou' : 'erro',
        erro: errMessage(e).slice(0, 500),
        tentativas,
        proxima_tentativa_em: new Date(Date.now() + esperaMinutos(tentativas) * 60e3).toISOString(),
      })
      .eq('id', ev.id)
    if (esgotou) await avisarFalha(sb, ev.workspace_id, ev.id)
    return esgotou ? 'falhou' : 'erro'
  }
}

async function avisarFalha(sb: SB, workspace_id: string, id: string) {
  await notificar(sb, workspace_id, {
    tipo: 'evento_falhou',
    chave: id,
    assunto: 'Uma mensagem recebida não pôde ser processada',
    titulo: 'Uma mensagem recebida não foi processada',
    linhas: [`Depois de ${MAX_TENTATIVAS} tentativas, o Maestro não conseguiu tratar uma mensagem que chegou por webhook (evento ${id}).`, 'Veja o histórico do ciclo em Setup. O conteúdo fica guardado por 7 dias para diagnóstico.'],
    link: '/setup',
  }).catch(() => {})
}

export interface RelatorioReprocesso {
  tentados: number
  processados: number
  com_erro: number
  falharam: number
}

/** Reprocessa o que está pendente ou com erro e já passou da hora da próxima tentativa. Chamado a cada rodada do agent-loop. */
export async function reprocessarEventos(sb: SB, opcoes: { limite?: number; temTempo?: () => boolean } = {}): Promise<RelatorioReprocesso> {
  const rel: RelatorioReprocesso = { tentados: 0, processados: 0, com_erro: 0, falharam: 0 }
  const agora = () => new Date().toISOString()
  const temTempo = opcoes.temTempo ?? (() => true)

  // Parados depois de esgotar as tentativas (por exemplo, a função caiu em todas): viram "falhou" e o operador é avisado.
  const { data: esgotados } = await sb
    .from('eventos_recebidos')
    .update({ status: 'falhou', erro: 'Esgotou as tentativas sem concluir' })
    .in('status', ['pendente', 'erro'])
    .gte('tentativas', MAX_TENTATIVAS)
    .lte('proxima_tentativa_em', agora())
    .select('id, workspace_id')
  for (const e of esgotados ?? []) {
    rel.falharam++
    await avisarFalha(sb, e.workspace_id, e.id)
  }

  const { data: fila } = await sb
    .from('eventos_recebidos')
    .select('id, workspace_id, canal, corpo_bruto, tentativas, proxima_tentativa_em')
    .in('status', ['pendente', 'erro'])
    .lt('tentativas', MAX_TENTATIVAS)
    .lte('proxima_tentativa_em', agora())
    .order('recebido_em')
    .limit(opcoes.limite ?? 20)

  for (const ev of fila ?? []) {
    if (!temTempo()) break
    // Reserva a tentativa antes de rodar (a conta já considera esta; se a função cair no meio, a próxima rodada não repete na hora).
    const tentativas = ev.tentativas + 1
    const { data: reservado } = await sb
      .from('eventos_recebidos')
      .update({ tentativas, proxima_tentativa_em: new Date(Date.now() + 10 * 60e3).toISOString() })
      .eq('id', ev.id)
      .eq('proxima_tentativa_em', ev.proxima_tentativa_em)
      .select('id')
      .maybeSingle()
    if (!reservado) continue
    rel.tentados++
    const r = await executarEvento(sb, { ...ev, tentativas }, { retomar: true })
    if (r === 'processado') rel.processados++
    else if (r === 'falhou') rel.falharam++
    else rel.com_erro++
  }
  return rel
}
