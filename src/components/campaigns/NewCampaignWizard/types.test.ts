import { describe, expect, it } from 'vitest'
import type { Campanha, Playbook } from '@/hooks/useCampaigns'
import { campanhaToDraft, draftFromPlaybook, draftToInsert, draftToPlaybook, emptyDraft, validateStep } from './types'

const playbook = {
  id: 'pb1',
  nome: 'Decisores B2B',
  descricao: 'x',
  icone: 'briefcase',
  fontes_padrao: ['apollo'],
  canais_padrao: ['email'],
  icp_padrao: { segmento: 'Serviços', cargos_alvo: ['CEO'], regioes: ['SP'], score_minimo: 70, volume_semanal: 30, criterios_exclusao: ['Franquias'] },
  persona_padrao: { nome: 'Arthur', tom: 'direto', produto: 'Consultoria', argumentos: ['a'], objecoes: [{ objecao: 'caro', resposta: 'vale' }, { objecao: 'sem resposta' }] },
  criterios_qualificacao_padrao: [{ campo: 'budget', pergunta: 'Quanto?', obrigatorio: false }, { campo: 'sem_pergunta' }],
  ativo: true,
  criado_em: '2026-01-01',
} as unknown as Playbook

describe('wizard de campanha: mapeamentos', () => {
  it('draftFromPlaybook aproveita o que existe e descarta itens incompletos', () => {
    const d = draftFromPlaybook(playbook)
    expect(d).toMatchObject({ playbook_id: 'pb1', nome: 'Decisores B2B', segmento: 'Serviços', score_minimo: 70, volume_semanal: 30, fontes: ['apollo'], canais: ['email'], persona_tom: 'direto' })
    expect(d.persona_objecoes).toEqual([{ objecao: 'caro', resposta: 'vale' }])
    expect(d.criterios_qualificacao).toEqual([{ campo: 'budget', pergunta: 'Quanto?', obrigatorio: false }])
    expect(d.criterios_exclusao).toEqual(['Franquias'])
  })

  it('playbook vazio cai nos valores padrão (nada de undefined)', () => {
    const d = draftFromPlaybook({ ...playbook, icp_padrao: null, persona_padrao: null, criterios_qualificacao_padrao: null, fontes_padrao: null, canais_padrao: null } as unknown as Playbook)
    expect(d.score_minimo).toBe(emptyDraft.score_minimo)
    expect(d.persona_tom).toBe(emptyDraft.persona_tom)
    expect(d.fontes).toEqual([])
    expect(d.persona_objecoes).toEqual([])
  })

  it('playbook → editor → playbook preserva os dados (ida e volta)', () => {
    const volta = draftToPlaybook(draftFromPlaybook(playbook), { descricao: 'x', icone: 'briefcase', ativo: true })
    expect(volta.icp_padrao).toMatchObject({ segmento: 'Serviços', cargos_alvo: ['CEO'], score_minimo: 70, criterios_exclusao: ['Franquias'] })
    expect(volta.persona_padrao).toMatchObject({ nome: 'Arthur', tom: 'direto' })
    expect(volta.fontes_padrao).toEqual(['apollo'])
  })

  it('campanhaToDraft → draftToInsert preserva a campanha', () => {
    const campanha = {
      id: 'c1', workspace_id: 'w1', playbook_id: null, nome: 'Camp', status: 'rascunho', segmento: 'Seg', cargos_alvo: ['Sócio'], regioes: ['Brasil'], score_minimo: 40, volume_semanal: 50,
      criterios_exclusao: ['x'], persona_nome: 'A', persona_tom: 'consultivo', persona_produto: 'P', persona_argumentos: ['arg'],
      persona_objecoes: [{ objecao: 'o', resposta: 'r' }], criterios_qualificacao: [{ campo: 'dor', pergunta: 'q', obrigatorio: true }], fontes: ['csv'], canais: ['email'],
      criado_em: '', atualizado_em: '',
    } as unknown as Campanha
    const ins = draftToInsert(campanhaToDraft(campanha), 'w1', 'ativa')
    expect(ins).toMatchObject({ workspace_id: 'w1', status: 'ativa', nome: 'Camp', score_minimo: 40, fontes: ['csv'], canais: ['email'], persona_nome: 'A' })
    expect(ins.criterios_qualificacao).toEqual([{ campo: 'dor', pergunta: 'q', obrigatorio: true }])
  })

  it('validateStep: exige nome e segmento (passo 1), fonte e canal (2), persona e produto (3)', () => {
    expect(validateStep(1, emptyDraft)).toMatch(/nome/i)
    expect(validateStep(1, { ...emptyDraft, nome: 'x' })).toMatch(/segmento/i)
    expect(validateStep(1, { ...emptyDraft, nome: 'x', segmento: 's', score_minimo: 150 })).toMatch(/score/i)
    expect(validateStep(1, { ...emptyDraft, nome: 'x', segmento: 's' })).toBeNull()
    expect(validateStep(2, emptyDraft)).toMatch(/fonte/i)
    expect(validateStep(2, { ...emptyDraft, fontes: ['csv'] })).toMatch(/canal/i)
    expect(validateStep(2, { ...emptyDraft, fontes: ['csv'], canais: ['email'] })).toBeNull()
    expect(validateStep(3, emptyDraft)).toMatch(/persona/i)
    expect(validateStep(3, { ...emptyDraft, persona_nome: 'A', persona_produto: 'P' })).toBeNull()
    expect(validateStep(0, emptyDraft)).toBeNull()
  })
})
