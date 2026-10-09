// deno-lint-ignore-file no-explicit-any
// health-check — vigia do sistema. Chamado pelo GitHub Actions (watchdog) a cada 30 min.
// Responde 200 se tudo está bem; 503 com a lista de problemas se algo está errado — o que faz o workflow falhar
// e o GitHub avisar por email. POST/GET com o header x-cron-secret.
import { corsHeaders, errMessage, isCronAuthorized, json, serviceClient } from '../_shared/util.ts'
import { ERRO_LIMITE } from '../_shared/execute.ts'

const CICLO_PARADO_MIN = 60 // o agent-loop roda a cada 15 min; o cron do GitHub pode atrasar, então a folga é grande
const ENVIO_FALHO_MIN = 60

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!isCronAuthorized(req)) return json({ error: 'Não autorizado' }, 401)
  const sb = serviceClient()
  const problemas: string[] = []

  try {
    const { data: ciclos } = await sb.from('ciclo_log').select('executado_em, erros, resumo').order('executado_em', { ascending: false }).limit(3)
    if (!ciclos?.length) problemas.push('Nenhuma rodada do agent-loop registrada ainda.')
    else {
      const minutos = Math.round((Date.now() - new Date(ciclos[0].executado_em).getTime()) / 60000)
      if (minutos > CICLO_PARADO_MIN) problemas.push(`O agent-loop não roda há ${minutos} minutos (esperado: a cada 15).`)
      if (ciclos.length === 3 && ciclos.every((c: any) => c.erros > 0)) {
        const ultimo = (ciclos[0].resumo?.erros ?? [])[0]
        problemas.push(`As últimas 3 rodadas do agent-loop tiveram erros. Exemplo: ${ultimo ? `${ultimo.etapa}: ${ultimo.erro}` : 'veja Setup → Visão geral'}`)
      }
    }

    const limite = new Date(Date.now() - ENVIO_FALHO_MIN * 60000).toISOString()
    const { count } = await sb
      .from('fila_acoes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'aprovada')
      .not('erro_execucao', 'is', null)
      .not('erro_execucao', 'like', `${ERRO_LIMITE}%`)
      .lt('aprovada_em', limite)
    if (count) problemas.push(`${count} ação(ões) aprovada(s) com falha de envio há mais de ${ENVIO_FALHO_MIN} min (Fila de Supervisão → Falhas de envio).`)
  } catch (e) {
    problemas.push(`O próprio health-check falhou: ${errMessage(e)}`)
  }

  return json({ ok: problemas.length === 0, problemas }, problemas.length ? 503 : 200)
})
