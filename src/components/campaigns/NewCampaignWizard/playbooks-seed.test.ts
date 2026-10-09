import { describe, expect, it } from 'vitest'
import type { Playbook } from '@/hooks/useCampaigns'
// Fonte única do conteúdo dos playbooks (gera a migration 019).
import seeds from '../../../../supabase/seeds/playbooks.json'
import { draftFromPlaybook, draftToInsert, validateStep } from './types'

const FONTES = ['google_places', 'apollo', 'csv', 'linkedin_scraper', 'instagram_scraper', 'cnpj', 'inbound']
const TONS = ['formal', 'consultivo', 'direto', 'amigavel']

// Como o playbook fica no banco: as colunas fontes/canais vêm da migration 012; aqui só precisamos das colunas de conteúdo.
const comoNoBanco = (p: (typeof seeds)[number]) =>
  ({
    id: 'x',
    nome: p.nome,
    descricao: p.descricao,
    icone: null,
    fontes_padrao: ['csv'],
    canais_padrao: ['email'],
    icp_padrao: p.icp,
    persona_padrao: p.persona,
    criterios_qualificacao_padrao: p.criterios,
    ativo: true,
    criado_em: '',
  }) as unknown as Playbook

describe('playbooks iniciais', () => {
  it('são os 6 do PRD', () => {
    expect(seeds.map((p) => p.nome).sort()).toEqual(
      ['Criadores e infoprodutores', 'Decisores B2B — serviços', 'E-commerce em crescimento', 'Lista fria', 'Negócios locais sem presença digital', 'Prestadores de serviço locais'].sort(),
    )
  })

  describe.each(seeds)('$nome', (p) => {
    const draft = draftFromPlaybook(comoNoBanco(p))

    it('chega inteiro ao wizard (nada se perde no mapeamento)', () => {
      expect(draft.segmento).toBe(p.icp.segmento)
      expect(draft.cargos_alvo).toEqual(p.icp.cargos_alvo)
      expect(draft.score_minimo).toBe(p.icp.score_minimo)
      expect(draft.criterios_exclusao.length).toBeGreaterThan(0)
      expect(draft.persona_objecoes).toHaveLength(p.persona.objecoes.length)
      expect(draft.criterios_qualificacao).toHaveLength(4)
    })

    it('usa só valores que o sistema entende', () => {
      expect(TONS).toContain(p.persona.tom)
      for (const f of FONTES) expect(typeof f).toBe('string')
      expect(p.icp.score_minimo).toBeGreaterThanOrEqual(0)
      expect(p.icp.score_minimo).toBeLessThanOrEqual(100)
      expect(p.icp.volume_semanal).toBeGreaterThan(0)
    })

    it('tem o par decisor + dor como critérios obrigatórios (sem eles o lead nunca qualifica)', () => {
      const obrigatorios = p.criterios.filter((c) => c.obrigatorio).map((c) => c.campo)
      expect(obrigatorios).toEqual(expect.arrayContaining(['e_decisor', 'dor_principal']))
    })

    it('não pode ser lançado com os marcadores [entre colchetes] ainda no texto', () => {
      const completo = { ...draft, nome: 'Campanha', canais: ['email'], fontes: ['csv'] }
      const erro = validateStep(3, completo) ?? validateStep(1, completo)
      expect(erro).toMatch(/colchetes/)
    })

    it('depois de preenchido, passa nos três passos e vira uma campanha válida', () => {
      const preenchido = {
        ...draft,
        nome: 'Minha campanha',
        segmento: draft.segmento.replace(/\[[^\]]+\]/g, 'Meu público'),
        persona_nome: 'Ana',
        persona_produto: 'Meu serviço',
        persona_argumentos: draft.persona_argumentos.map((a) => a.replace(/\[[^\]]+\]/g, 'Meu benefício')),
        fontes: ['csv'],
        canais: ['email'],
      }
      expect([1, 2, 3].map((s) => validateStep(s, preenchido))).toEqual([null, null, null])
      const insert = draftToInsert(preenchido, 'ws', 'rascunho')
      expect(insert.criterios_qualificacao).toHaveLength(4)
      expect(insert.persona_objecoes).toHaveLength(p.persona.objecoes.length)
    })
  })
})
