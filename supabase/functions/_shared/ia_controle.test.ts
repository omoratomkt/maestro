import { assertEquals } from 'jsr:@std/assert@1'
import { interpretarPausa } from './ia_controle.ts'

Deno.test('interruptor geral: só pausa com o valor exatamente true', () => {
  assertEquals(interpretarPausa({ pausada: true }), true)
  for (const v of [{ pausada: false }, { pausada: 'true' }, { pausada: 1 }, {}, null, undefined, 'x', []]) {
    assertEquals(interpretarPausa(v), false, JSON.stringify(v))
  }
})
