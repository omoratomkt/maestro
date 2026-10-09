// deno-lint-ignore-file no-explicit-any
import { sendMessage } from './channels.ts'
import { upsertEstado } from './agent.ts'
import { errMessage, nextBusinessSlot, type SB } from './util.ts'

export interface ExecuteResult {
  ok: boolean
  fila_id: string
  detalhe: string
}

const TENTATIVAS: Record<string, string> = {
  whatsapp: 'tentativas_whatsapp',
  email: 'tentativas_email',
  linkedin: 'tentativas_linkedin',
  instagram: 'tentativas_instagram',
}

/**
 * Envia uma ação aprovada (ou automática) pelo canal certo e registra tudo.
 * O claim em `executada_em` impede envio duplicado se duas execuções correrem ao mesmo tempo.
 */
export async function executeAction(sb: SB, fila_id: string): Promise<ExecuteResult> {
  const { data: claimed } = await sb
    .from('fila_acoes')
    .update({ executada_em: new Date().toISOString(), erro_execucao: null })
    .eq('id', fila_id)
    .eq('status', 'aprovada')
    .is('executada_em', null)
    .select('*')
    .maybeSingle()
  if (!claimed) return { ok: false, fila_id, detalhe: 'ação não está aprovada, ou já foi executada' }

  const fail = async (msg: string): Promise<ExecuteResult> => {
    await sb.from('fila_acoes').update({ executada_em: null, erro_execucao: msg.slice(0, 500) }).eq('id', fila_id)
    return { ok: false, fila_id, detalhe: msg }
  }

  try {
    const { data: p } = await sb.from('prospects').select('*').eq('id', claimed.prospect_id).single()
    const { data: c } = await sb.from('campanhas').select('canais').eq('id', claimed.campanha_id).single()
    const texto: string = claimed.mensagem_editada ?? claimed.mensagem

    let ultimaRespostaEmail = null
    if (claimed.canal === 'email') {
      const { data: last } = await sb
        .from('prospect_interacoes')
        .select('metadata')
        .eq('prospect_id', p.id)
        .eq('canal', 'email')
        .eq('direcao', 'in')
        .order('enviado_em', { ascending: false })
        .limit(1)
      ultimaRespostaEmail = last?.[0]?.metadata ?? null
    }

    // Dados de demonstração: nada sai para ninguém; o envio é simulado para a conversa e o estado seguirem o fluxo real.
    let igsid: string | null = null
    if (claimed.canal === 'instagram') {
      const { data: last } = await sb
        .from('prospect_interacoes')
        .select('metadata')
        .eq('prospect_id', p.id)
        .eq('canal', 'instagram')
        .eq('direcao', 'in')
        .order('enviado_em', { ascending: false })
        .limit(1)
      igsid = (last?.[0]?.metadata as { igsid?: string } | undefined)?.igsid ?? null
    }

    const sent =
      p.fonte === 'demo'
        ? { provider: 'simulado', message_id: undefined, metadata: { simulado: true } }
        : await sendMessage(sb, {
            workspace_id: p.workspace_id,
            campanhaCanais: c?.canais ?? [],
            canal: claimed.canal,
            texto,
            prospect: p,
            ultimaRespostaEmail,
            igsid,
          })

    const agora = new Date().toISOString()
    await sb.from('prospect_interacoes').insert({
      prospect_id: p.id,
      canal: claimed.canal,
      direcao: 'out',
      conteudo: texto,
      status: 'enviado',
      enviado_em: agora,
      metadata: {
        autor: claimed.fluxo_automatico_id ? 'fluxo' : claimed.mensagem_editada ? 'humano' : 'agente',
        fila_id,
        provider: sent.provider,
        message_id: sent.message_id,
        ...sent.metadata,
      },
    })

    const encerrar = claimed.tipo === 'encerrar'
    await sb
      .from('prospects')
      .update({
        status: encerrar ? 'descartado' : p.status === 'novo' ? 'em_contato' : p.status,
        primeiro_contato_em: p.primeiro_contato_em ?? agora,
        ultima_interacao_em: agora,
        canal_principal: p.canal_principal ?? claimed.canal,
        atualizado_em: agora,
      })
      .eq('id', p.id)

    const { data: estado } = await sb.from('prospect_estado').select('*').eq('prospect_id', p.id).maybeSingle()
    const col = TENTATIVAS[claimed.canal]
    // Resposta ao prospect não conta como "tentativa sem resposta"; follow-ups e primeiras mensagens contam.
    const conta = claimed.tipo !== 'resposta' && claimed.tipo !== 'encerrar'
    await upsertEstado(sb, p.id, {
      aguardando: encerrar ? 'nenhum' : 'resposta',
      proxima_acao_em: encerrar ? null : nextBusinessSlot(claimed.tipo === 'resposta' ? 24 : 48).toISOString(),
      ...(col && conta ? { [col]: (estado?.[col] ?? 0) + 1 } : {}),
      ...(col && claimed.tipo === 'resposta' ? { [col]: 0 } : {}),
    })

    if (claimed.fluxo_automatico_id) {
      const { data: f } = await sb.from('fluxos_automaticos').select('total_execucoes').eq('id', claimed.fluxo_automatico_id).single()
      await sb.from('fluxos_automaticos').update({ total_execucoes: (f?.total_execucoes ?? 0) + 1 }).eq('id', claimed.fluxo_automatico_id)
    }

    await sb.from('fila_acoes').update({ status: 'executada' }).eq('id', fila_id)
    return { ok: true, fila_id, detalhe: `enviado via ${sent.provider}` }
  } catch (e) {
    return await fail(errMessage(e))
  }
}
