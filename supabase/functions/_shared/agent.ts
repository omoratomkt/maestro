// deno-lint-ignore-file no-explicit-any
// O agente: lê o contexto completo do prospect (todos os canais) e decide o próximo passo.
import { askClaude } from './anthropic.ts'
import { availableChannels, type Canal } from './channels.ts'
import { firstName, nextBusinessSlot, type SB } from './util.ts'

export type ProposeOutcome =
  | { resultado: 'fila'; fila_id: string }
  | { resultado: 'automatica'; fila_id: string; fluxo_id: string }
  | { resultado: 'aguardando'; ate: string }
  | { resultado: 'encerrado' }
  | { resultado: 'humano' }
  | { resultado: 'ignorado'; motivo: string }

interface Decision {
  decisao: 'enviar' | 'aguardar' | 'encerrar' | 'aguardar_humano'
  tipo: 'primeira_mensagem' | 'followup' | 'resposta' | 'reengajamento' | 'encerrar'
  canal: string
  mensagem: string
  razao: string
  aguardar_horas: number
  resumo_contexto: string
}

const TIPOS_AUTOMATIZAVEIS = ['primeira_mensagem', 'followup', 'reengajamento']
const MAX_TENTATIVAS_POR_CANAL = 3

function personaPrompt(c: any, canaisDisponiveis: string[]): string {
  const objecoes = (Array.isArray(c.persona_objecoes) ? c.persona_objecoes : [])
    .map((o: any) => `- "${o.objecao}" → ${o.resposta}`)
    .join('\n')
  const criterios = (Array.isArray(c.criterios_qualificacao) ? c.criterios_qualificacao : [])
    .map((q: any) => `- ${q.campo}${q.obrigatorio ? ' (obrigatório)' : ''}: ${q.pergunta}`)
    .join('\n')
  return `Você é ${c.persona_nome ?? 'o representante comercial'}, responsável pela prospecção outbound.
Produto/serviço que você apresenta: ${c.persona_produto ?? '(não informado)'}
Tom de voz: ${c.persona_tom ?? 'consultivo'}
Argumentos principais:
${(c.persona_argumentos ?? []).map((a: string) => `- ${a}`).join('\n') || '- (nenhum informado)'}
Objeções conhecidas e como responder:
${objecoes || '- (nenhuma informada)'}
Critérios de qualificação (confirme em conversa, de forma natural, uma pergunta por vez):
${criterios || '- (nenhum informado)'}

Sua tarefa: olhar a conversa completa com este prospect (todos os canais) e decidir o próximo passo.

Regras:
- Escreva em português do Brasil. WhatsApp e LinkedIn: 1 a 3 frases curtas e naturais. Email: até 6 frases, com assunto na primeira linha ("Assunto: ...") apenas no primeiro contato.
- Uma pergunta por mensagem. Nunca faça mais de uma mensagem seguida sem resposta.
- Nunca invente preços, prazos, resultados, clientes ou funcionalidades que não estejam descritos acima. Se perguntarem algo que você não sabe responder, use decisao "aguardar_humano".
- Se perguntarem diretamente se estão falando com uma pessoa ou com uma IA, responda com honestidade que você é um assistente virtual (e siga ajudando).
- Se a pessoa pedir ligação, reunião com uma pessoa, proposta formal ou algo que só um humano resolve: decisao "aguardar_humano" (sem mensagem).
- Se recusar claramente: decisao "encerrar", tipo "encerrar", com uma despedida curta e educada.
- Se pedir para retomar mais tarde: decisao "aguardar" com aguardar_horas igual ao combinado.
- Até ${MAX_TENTATIVAS_POR_CANAL} tentativas por canal sem resposta; depois mude de canal (se houver) ou encerre.
- Quando todos os critérios obrigatórios já estiverem confirmados, não faça mais perguntas: proponha o próximo passo (conversa de 30 minutos) com duas opções de horário.
- Se a última mensagem do prospect ainda não foi respondida, o tipo é "resposta". Se o prospect nunca foi contatado, o tipo é "primeira_mensagem".
- Canais disponíveis agora: ${canaisDisponiveis.join(', ')}. Use apenas esses.
- aguardar_horas: quantas horas esperar antes de olhar este prospect de novo (24 a 168 é o normal).
- resumo_contexto: 1 a 3 frases com o que você já sabe do prospect (para sua própria memória na próxima vez).
- razao: 1 a 2 frases, em português, explicando ao operador humano por que você escolheu isso, citando fatos da conversa.`
}

function decisionSchema(canais: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['decisao', 'tipo', 'canal', 'mensagem', 'razao', 'aguardar_horas', 'resumo_contexto'],
    properties: {
      decisao: { type: 'string', enum: ['enviar', 'aguardar', 'encerrar', 'aguardar_humano'] },
      tipo: { type: 'string', enum: ['primeira_mensagem', 'followup', 'resposta', 'reengajamento', 'encerrar'] },
      canal: { type: 'string', enum: canais },
      mensagem: { type: 'string' },
      razao: { type: 'string' },
      aguardar_horas: { type: 'integer' },
      resumo_contexto: { type: 'string' },
    },
  }
}

function weekdayBrt(d = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(d)
}

function render(template: string, prospect: any): string {
  return template
    .replaceAll('{nome}', firstName(prospect.nome_contato) || prospect.nome_empresa)
    .replaceAll('{empresa}', prospect.nome_empresa)
}

/** Fluxo automático ativo que cobre esta ação (só tipos sem resposta direta ao prospect). */
async function matchFlow(sb: SB, p: any, tipo: string, canal: string) {
  if (!TIPOS_AUTOMATIZAVEIS.includes(tipo)) return null
  const { data } = await sb
    .from('fluxos_automaticos')
    .select('*')
    .eq('workspace_id', p.workspace_id)
    .eq('ativo', true)
    .eq('tipo_acao', tipo)
    .eq('canal_acao', canal)
    .or(`campanha_id.is.null,campanha_id.eq.${p.campanha_id}`)
    .limit(1)
  return data?.[0] ?? null
}

/**
 * Decide o próximo passo de UM prospect e registra o resultado:
 * proposta na fila de supervisão, execução automática (fluxo promovido), espera, encerramento ou espera por humano.
 */
export async function proposeNextAction(sb: SB, prospect_id: string, opts: { followup?: boolean } = {}): Promise<ProposeOutcome> {
  const { data: p } = await sb.from('prospects').select('*').eq('id', prospect_id).maybeSingle()
  if (!p) return { resultado: 'ignorado', motivo: 'prospect não encontrado' }
  if (p.fonte === 'demo') return { resultado: 'ignorado', motivo: 'demo: dados de demonstração não são processados' }
  if (['descartado', 'convertido'].includes(p.status)) return { resultado: 'ignorado', motivo: `prospect ${p.status}` }

  const { data: c } = await sb.from('campanhas').select('*').eq('id', p.campanha_id).maybeSingle()
  if (!c || c.status !== 'ativa') return { resultado: 'ignorado', motivo: 'campanha não está ativa' }

  const { data: abertas } = await sb.from('fila_acoes').select('id').eq('prospect_id', p.id).in('status', ['pendente', 'aprovada']).limit(1)
  if (abertas?.length) return { resultado: 'ignorado', motivo: 'já existe ação aguardando aprovação ou envio' }

  const canais = await availableChannels(sb, { workspace_id: p.workspace_id, campanhaCanais: c.canais ?? [] })
  const { data: estado } = await sb.from('prospect_estado').select('*').eq('prospect_id', p.id).maybeSingle()
  if (canais.length === 0) {
    await upsertEstado(sb, p.id, { aguardando: 'nenhum', proxima_acao_em: nextBusinessSlot(24).toISOString() })
    return { resultado: 'ignorado', motivo: 'nenhum canal disponível (integração ativa + envio implementado)' }
  }

  const { data: msgs } = await sb
    .from('prospect_interacoes')
    .select('canal, direcao, conteudo, enviado_em')
    .eq('prospect_id', p.id)
    .order('enviado_em', { ascending: false })
    .limit(30)
  const conversa = (msgs ?? []).reverse().map((m: any) => ({ quando: m.enviado_em, canal: m.canal, de: m.direcao === 'in' ? 'prospect' : 'nós', texto: m.conteudo }))

  const dados = p.dados_enriquecimento ?? {}
  const contexto = {
    agora: weekdayBrt(),
    modo_followup_em_lote: Boolean(opts.followup),
    prospect: {
      empresa: p.nome_empresa,
      contato: p.nome_contato,
      cargo: p.cargo,
      segmento: p.segmento,
      cidade: p.cidade,
      estado: p.estado,
      score_icp: p.score,
      status: p.status,
      canal_com_mais_engajamento: p.canal_principal,
      sinais_de_timing: p.sinais_timing,
      site: dados.site?.titulo ?? p.website,
      google_rating: dados.google_rating,
    },
    memoria_anterior: estado?.contexto_resumo ?? null,
    tentativas_sem_resposta: {
      whatsapp: estado?.tentativas_whatsapp ?? 0,
      email: estado?.tentativas_email ?? 0,
      linkedin: estado?.tentativas_linkedin ?? 0,
      instagram: estado?.tentativas_instagram ?? 0,
    },
    conversa: conversa.length ? conversa : 'nenhuma mensagem ainda (primeiro contato)',
  }

  const d = await askClaude<Decision>(sb, {
    workspace_id: p.workspace_id,
    prospect_id: p.id,
    origem: 'agent',
    tier: 'sonnet',
    effort: 'medium',
    system: personaPrompt(c, canais),
    user: JSON.stringify(contexto),
    schema: decisionSchema(canais),
    maxTokens: 2500,
  })

  const canal: Canal = (canais as string[]).includes(d.canal) ? (d.canal as Canal) : canais[0]
  const resumo = (d.resumo_contexto ?? '').slice(0, 800) || estado?.contexto_resumo || null
  const horas = Math.min(Math.max(Math.round(d.aguardar_horas || 24), 1), 24 * 60)

  if (d.decisao === 'aguardar_humano') {
    await upsertEstado(sb, p.id, { aguardando: 'nenhum', proxima_acao_em: null, contexto_resumo: resumo })
    return { resultado: 'humano' }
  }

  if (d.decisao === 'aguardar' || !d.mensagem.trim()) {
    if (d.decisao === 'encerrar') {
      await sb.from('prospects').update({ status: 'descartado', atualizado_em: new Date().toISOString() }).eq('id', p.id)
      await upsertEstado(sb, p.id, { aguardando: 'nenhum', proxima_acao_em: null, contexto_resumo: resumo })
      return { resultado: 'encerrado' }
    }
    const ate = nextBusinessSlot(horas)
    await upsertEstado(sb, p.id, { aguardando: 'tempo', proxima_acao_em: ate.toISOString(), contexto_resumo: resumo })
    return { resultado: 'aguardando', ate: ate.toISOString() }
  }

  const tipo = d.decisao === 'encerrar' ? 'encerrar' : d.tipo
  const flow = await matchFlow(sb, p, tipo, canal)
  const base = { workspace_id: p.workspace_id, prospect_id: p.id, campanha_id: p.campanha_id, tipo, canal, razao: d.razao }

  if (flow) {
    const { data: row, error } = await sb
      .from('fila_acoes')
      .insert({ ...base, mensagem: render(flow.template_mensagem, p), status: 'aprovada', aprovada_em: new Date().toISOString(), fluxo_automatico_id: flow.id })
      .select('id')
      .single()
    if (error) throw new Error(`Falha ao registrar ação automática: ${error.message}`)
    await upsertEstado(sb, p.id, { aguardando: 'resposta', proxima_acao_em: null, contexto_resumo: resumo })
    return { resultado: 'automatica', fila_id: row.id, fluxo_id: flow.id }
  }

  const { data: row, error } = await sb
    .from('fila_acoes')
    .insert({ ...base, mensagem: d.mensagem.trim(), status: 'pendente', expira_em: new Date(Date.now() + 48 * 3600e3).toISOString() })
    .select('id')
    .single()
  if (error) throw new Error(`Falha ao registrar proposta: ${error.message}`)
  await upsertEstado(sb, p.id, { aguardando: 'aprovacao', proxima_acao_em: null, contexto_resumo: resumo })
  return { resultado: 'fila', fila_id: row.id }
}

export async function upsertEstado(sb: SB, prospect_id: string, patch: Record<string, unknown>) {
  const { error } = await sb
    .from('prospect_estado')
    .upsert({ prospect_id, ...patch, atualizado_em: new Date().toISOString() }, { onConflict: 'prospect_id' })
  if (error) throw new Error(`Falha ao atualizar estado do agente: ${error.message}`)
}
