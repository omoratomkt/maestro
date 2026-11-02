import { describe, expect, it } from 'vitest'
import { RESULTADO_ROTULO, usd } from './agentes'

describe('agentes', () => {
  it('formata custo em dólar com 2 a 4 casas', () => {
    expect(usd(0)).toBe('US$ 0,00')
    expect(usd(1.5)).toBe('US$ 1,50')
    expect(usd(0.004)).toBe('US$ 0,004')
  })
  it('todo resultado do registro tem rótulo em português', () => {
    for (const r of ['ok', 'erro', 'bloqueado', 'pausada']) expect(RESULTADO_ROTULO[r]).toBeTruthy()
  })
})
