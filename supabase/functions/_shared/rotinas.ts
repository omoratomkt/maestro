// deno-lint-ignore-file no-explicit-any
// Rotinas periódicas executadas dentro do agent-loop: resumo diário por email e foto horária das métricas.
import { notificar } from './notify.ts'
import { errMessage, type SB } from './util.ts'

const OFFSET_BRT_MS = 3 * 3600e3

/** Resumo de segunda a sexta, a partir das 9h (Brasília), uma vez por dia e só se houver algo a fazer. */
export async function enviarResumosDiarios(sb: SB, agora = new Date()): Promise<Record<string, string>> {
  const brt = new Date(agora.getTime() - OFFSET_BRT_MS)
  if (brt.getUTCDay() === 0 || brt.getUTCDay() === 6 || brt.getUTCHours() < 9) return {}
  const hoje = brt.toISOString().slice(0, 10)

  const { data: configurados } = await sb.from('integracoes').select('workspace_id').eq('tipo', 'notificacoes_email').eq('ativo', true)
  const resultado: Record<string, string> = {}
  for (const { workspace_id } of configurados ?? []) {
    try {
      const { data: ja } = await sb.from('notificacoes_log').select('id').eq('workspace_id', workspace_id).eq('tipo', 'resumo_diario').eq('chave', hoje).limit(1)
      if (ja?.length) continue
      const { data: r } = await sb.rpc('resumo_operacional', { p_ws: workspace_id })
      const n = (r ?? {}) as Record<string, number>
      const linhas = [
        n.pendentes_na_fila ? `${n.pendentes_na_fila} ação(ões) aguardando a sua aprovação na Fila de Supervisão.` : null,
        n.aguardando_humano ? `${n.aguardando_humano} prospect(s) esperando uma resposta sua (o agente não tem o que propor).` : null,
        n.leads_sem_reuniao ? `${n.leads_sem_reuniao} lead(s) qualificado(s) ainda sem reunião marcada.` : null,
        n.falhas_de_envio ? `${n.falhas_de_envio} mensagem(ns) aprovada(s) que não foram enviadas (veja "Falhas de envio").` : null,
      ].filter(Boolean) as string[]
      if (!linhas.length) continue
      resultado[workspace_id] = await notificar(sb, workspace_id, {
        tipo: 'resumo_diario',
        chave: hoje,
        assunto: 'Maestro: o que precisa da sua atenção hoje',
        titulo: 'O que precisa da sua atenção hoje',
        linhas,
        link: n.pendentes_na_fila ? '/fila' : '/inbox',
      })
    } catch (e) {
      resultado[workspace_id] = `erro: ${errMessage(e)}`
    }
  }
  return resultado
}

/** Foto das métricas por campanha. Roda no primeiro ciclo de cada hora (o agent-loop roda a cada 15 min). */
export async function snapshotMetricas(sb: SB, agora = new Date()): Promise<string> {
  if (agora.getUTCMinutes() >= 15) return 'fora da janela'
  const { data, error } = await sb.rpc('registrar_snapshot_metricas')
  return error ? `erro: ${error.message}` : `${data} campanha(s)`
}
