// deno-lint-ignore-file no-explicit-any
// Avisos por email ao operador (Resend), configurados em Setup → Integrações → "Avisos por email".
// Nunca derrubam o fluxo que os chamou: qualquer falha vira texto de retorno, não exceção.
import { getCredentials } from './credentials.ts'
import { errMessage, type SB } from './util.ts'

export type TipoNotificacao = 'lead_qualificado' | 'reuniao_agendada' | 'reuniao_cancelada' | 'aguarda_humano' | 'resumo_diario'

export interface Aviso {
  tipo: TipoNotificacao
  /** Identifica o fato (lead, prospect, mensagem, data): o mesmo fato nunca é avisado duas vezes. */
  chave: string
  assunto: string
  titulo: string
  linhas: string[]
  /** Caminho dentro do app para o botão "Abrir no Maestro", ex.: "/fila". */
  link?: string
}

const APP_URL_PADRAO = 'https://maestro-tau-rouge.vercel.app'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function montarEmail(a: Aviso, appUrl: string): { html: string; text: string } {
  const url = `${appUrl.replace(/\/$/, '')}${a.link ?? '/'}`
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;line-height:1.5">
  <p style="font-size:13px;color:#666;margin:0 0 18px">Maestro · Morato</p>
  <h2 style="margin:0 0 14px;font-size:19px">${esc(a.titulo)}</h2>
${a.linhas.map((l) => `  <p style="margin:0 0 10px;font-size:15px">${esc(l)}</p>`).join('\n')}
  <p style="margin:22px 0"><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:15px">Abrir no Maestro</a></p>
  <p style="margin:0;font-size:12px;color:#666">Você recebe este aviso porque seu email está na lista de avisos do workspace. Para parar, remova-o em Setup → Integrações → Avisos por email.</p>
</div>`
  const text = `${a.titulo}\n\n${a.linhas.join('\n')}\n\nAbrir no Maestro: ${url}`
  return { html, text }
}

export function parseDestinatarios(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
}

/** Envia o aviso (uma vez por tipo+chave). Retorna 'enviado', 'duplicado', 'sem_config' ou 'erro: ...'. */
export async function notificar(sb: SB, workspace_id: string, a: Aviso): Promise<string> {
  let cfg: Record<string, string>
  try {
    cfg = await getCredentials(sb, workspace_id, 'notificacoes_email')
  } catch {
    return 'sem_config'
  }
  const to = parseDestinatarios(cfg.destinatarios)
  if (!to.length || !cfg.api_key || !cfg.remetente) return 'sem_config'

  try {
    // Reserva o aviso antes de enviar; se outro processo já reservou, não repete.
    const { data: reservado, error } = await sb
      .from('notificacoes_log')
      .upsert({ workspace_id, tipo: a.tipo, chave: a.chave }, { onConflict: 'workspace_id,tipo,chave', ignoreDuplicates: true })
      .select('id')
    if (error) return `erro: ${error.message}`
    if (!reservado?.length) return 'duplicado'

    const { html, text } = montarEmail(a, cfg.app_url || APP_URL_PADRAO)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.remetente, to, subject: a.assunto, html, text }),
    })
    if (!res.ok) {
      // Libera a reserva para a próxima tentativa.
      await sb.from('notificacoes_log').delete().eq('id', reservado[0].id)
      return `erro: Resend ${res.status}: ${(await res.text()).slice(0, 200)}`
    }
    return 'enviado'
  } catch (e) {
    return `erro: ${errMessage(e)}`
  }
}
