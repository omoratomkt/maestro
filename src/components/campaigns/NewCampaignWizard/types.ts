import type { Campanha, Playbook } from '@/hooks/useCampaigns'
import type { Json, TablesInsert } from '@/types/database'

export interface Objecao {
  objecao: string
  resposta: string
}

export interface CriterioQualificacao {
  campo: string
  pergunta: string
  obrigatorio: boolean
}

export interface CampaignDraft {
  playbook_id: string | null
  nome: string
  // ICP
  segmento: string
  cargos_alvo: string[]
  regioes: string[]
  score_minimo: number
  volume_semanal: number
  criterios_exclusao: string[]
  // Fontes e canais
  fontes: string[]
  canais: string[]
  // Persona
  persona_nome: string
  persona_tom: string
  persona_produto: string
  persona_argumentos: string[]
  persona_objecoes: Objecao[]
  // Qualificação
  criterios_qualificacao: CriterioQualificacao[]
}

export const emptyDraft: CampaignDraft = {
  playbook_id: null,
  nome: '',
  segmento: '',
  cargos_alvo: [],
  regioes: [],
  score_minimo: 60,
  volume_semanal: 50,
  criterios_exclusao: [],
  fontes: [],
  canais: [],
  persona_nome: '',
  persona_tom: 'consultivo',
  persona_produto: '',
  persona_argumentos: [],
  persona_objecoes: [],
  criterios_qualificacao: [],
}

const obj = (v: Json | null | undefined): Record<string, Json | undefined> =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {}
const str = (v: Json | undefined) => (typeof v === 'string' ? v : undefined)
const num = (v: Json | undefined) => (typeof v === 'number' ? v : undefined)
const strs = (v: Json | undefined) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined)

/** Pré-preenche o rascunho com os defaults do playbook (campos ausentes são ignorados). */
export function draftFromPlaybook(p: Playbook): CampaignDraft {
  const icp = obj(p.icp_padrao)
  const persona = obj(p.persona_padrao)
  const objecoes = Array.isArray(persona.objecoes)
    ? persona.objecoes.flatMap((o) => {
        const x = obj(o)
        return str(x.objecao) && str(x.resposta) ? [{ objecao: str(x.objecao)!, resposta: str(x.resposta)! }] : []
      })
    : []
  const criterios = Array.isArray(p.criterios_qualificacao_padrao)
    ? p.criterios_qualificacao_padrao.flatMap((c) => {
        const x = obj(c)
        return str(x.campo) && str(x.pergunta)
          ? [{ campo: str(x.campo)!, pergunta: str(x.pergunta)!, obrigatorio: x.obrigatorio !== false }]
          : []
      })
    : []
  return {
    ...emptyDraft,
    playbook_id: p.id,
    nome: p.nome,
    segmento: str(icp.segmento) ?? '',
    cargos_alvo: strs(icp.cargos_alvo) ?? [],
    regioes: strs(icp.regioes) ?? [],
    criterios_exclusao: strs(icp.criterios_exclusao) ?? [],
    score_minimo: num(icp.score_minimo) ?? emptyDraft.score_minimo,
    volume_semanal: num(icp.volume_semanal) ?? emptyDraft.volume_semanal,
    fontes: p.fontes_padrao ?? [],
    canais: p.canais_padrao ?? [],
    persona_nome: str(persona.nome) ?? '',
    persona_tom: str(persona.tom) ?? emptyDraft.persona_tom,
    persona_produto: str(persona.produto) ?? '',
    persona_argumentos: strs(persona.argumentos) ?? [],
    persona_objecoes: objecoes,
    criterios_qualificacao: criterios,
  }
}

export function draftToInsert(
  d: CampaignDraft,
  workspace_id: string,
  status: 'rascunho' | 'ativa',
): TablesInsert<'campanhas'> {
  return {
    workspace_id,
    status,
    playbook_id: d.playbook_id,
    nome: d.nome.trim(),
    segmento: d.segmento.trim() || null,
    cargos_alvo: d.cargos_alvo,
    regioes: d.regioes,
    score_minimo: d.score_minimo,
    volume_semanal: d.volume_semanal,
    criterios_exclusao: d.criterios_exclusao,
    fontes: d.fontes,
    canais: d.canais,
    persona_nome: d.persona_nome.trim() || null,
    persona_tom: d.persona_tom,
    persona_produto: d.persona_produto.trim() || null,
    persona_argumentos: d.persona_argumentos,
    persona_objecoes: d.persona_objecoes as unknown as Json,
    criterios_qualificacao: d.criterios_qualificacao as unknown as Json,
  }
}

/** Validação por passo (índice 0–4). Retorna mensagem de erro ou null. */
export function validateStep(step: number, d: CampaignDraft): string | null {
  if (step === 1) {
    if (!d.nome.trim()) return 'Dê um nome à campanha.'
    if (!d.segmento.trim()) return 'Informe o segmento alvo.'
    if (d.score_minimo < 0 || d.score_minimo > 100) return 'O score mínimo deve estar entre 0 e 100.'
  }
  if (step === 2) {
    if (d.fontes.length === 0) return 'Selecione ao menos uma fonte de prospects.'
    if (d.canais.length === 0) return 'Selecione ao menos um canal.'
  }
  if (step === 3) {
    if (!d.persona_nome.trim() || !d.persona_produto.trim()) return 'Informe o nome da persona e o produto/serviço oferecido.'
  }
  return null
}

/** Rascunho a partir de uma campanha existente (modo edição). */
export function campanhaToDraft(c: Campanha): CampaignDraft {
  const objecoes = Array.isArray(c.persona_objecoes)
    ? c.persona_objecoes.flatMap((o) => {
        const x = obj(o)
        return [{ objecao: str(x.objecao) ?? '', resposta: str(x.resposta) ?? '' }]
      })
    : []
  const criterios = Array.isArray(c.criterios_qualificacao)
    ? c.criterios_qualificacao.flatMap((o) => {
        const x = obj(o)
        return [{ campo: str(x.campo) ?? '', pergunta: str(x.pergunta) ?? '', obrigatorio: x.obrigatorio !== false }]
      })
    : []
  return {
    playbook_id: c.playbook_id,
    nome: c.nome,
    segmento: c.segmento ?? '',
    cargos_alvo: c.cargos_alvo ?? [],
    regioes: c.regioes ?? [],
    score_minimo: c.score_minimo,
    volume_semanal: c.volume_semanal ?? emptyDraft.volume_semanal,
    criterios_exclusao: strs(c.criterios_exclusao) ?? [],
    fontes: c.fontes ?? [],
    canais: c.canais ?? [],
    persona_nome: c.persona_nome ?? '',
    persona_tom: c.persona_tom ?? emptyDraft.persona_tom,
    persona_produto: c.persona_produto ?? '',
    persona_argumentos: c.persona_argumentos ?? [],
    persona_objecoes: objecoes,
    criterios_qualificacao: criterios,
  }
}

/** Payload de playbook a partir do editor (mesmo formato lido por draftFromPlaybook). */
export function draftToPlaybook(
  d: CampaignDraft,
  extra: { descricao: string; icone: string; ativo: boolean },
): TablesInsert<'playbooks'> {
  return {
    nome: d.nome.trim(),
    descricao: extra.descricao.trim() || null,
    icone: extra.icone.trim() || null,
    ativo: extra.ativo,
    fontes_padrao: d.fontes,
    canais_padrao: d.canais,
    icp_padrao: {
      segmento: d.segmento.trim(),
      cargos_alvo: d.cargos_alvo,
      regioes: d.regioes,
      score_minimo: d.score_minimo,
      volume_semanal: d.volume_semanal,
      criterios_exclusao: d.criterios_exclusao,
    },
    persona_padrao: {
      nome: d.persona_nome.trim(),
      tom: d.persona_tom,
      produto: d.persona_produto.trim(),
      argumentos: d.persona_argumentos,
      objecoes: d.persona_objecoes,
    } as unknown as Json,
    criterios_qualificacao_padrao: d.criterios_qualificacao as unknown as Json,
  }
}
