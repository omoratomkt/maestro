import { describe, expect, it } from 'vitest'
// As MESMAS fixtures são usadas pelos testes das Edge Functions (Deno): frontend e backend não podem normalizar diferente.
import fixtures from '../../supabase/functions/_shared/suppression.fixtures.json'
import { chaveDaLinha, chavesDoContato, normalizarSupressao } from './suppression'

describe('lista de supressão: paridade com o backend', () => {
  it.each(fixtures.normalizar)('normaliza $tipo "$entrada"', ({ tipo, entrada, saida }) => {
    expect(normalizarSupressao(tipo, entrada)).toBe(saida)
  })

  it.each(fixtures.chaves)('chaves do contato %#', ({ contato, chaves }) => {
    expect([...chavesDoContato(contato)].sort()).toEqual([...chaves].sort())
  })

  it('a chave de uma linha da lista casa com a chave do contato (WhatsApp pelos 8 últimos dígitos)', () => {
    const linha = chaveDaLinha('whatsapp', normalizarSupressao('whatsapp', '(11) 91234-5678'))
    expect(chavesDoContato({ whatsapp: '+55 11 1234-5678' })).toContain(linha)
    expect(chavesDoContato({ whatsapp: '11 2345-5678' })).not.toContain(linha)
  })
})
