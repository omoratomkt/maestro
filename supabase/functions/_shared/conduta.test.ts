import { assertEquals } from 'jsr:@std/assert@1'
import { palavrasProibidas } from './conduta.ts'

Deno.test('conduta: promessa de resultado, urgência falsa e propaganda são achadas', () => {
  assertEquals(palavrasProibidas('Resultado garantido em 30 dias!'), ['promessa de resultado: "garantido"'])
  assertEquals(palavrasProibidas('Última chance, só hoje: vamos dobrar suas vendas'), [
    'promessa de resultado: "dobrar suas vendas"',
    'urgência falsa: "ultima chance"',
    'urgência falsa: "so hoje"',
  ])
  assertEquals(palavrasProibidas('Uma solução REVOLUCIONÁRIA para turbinar o time'), ['linguagem de propaganda: "revolucionaria"', 'linguagem de propaganda: "turbinar"'])
})

Deno.test('conduta: mensagem comercial normal não é marcada', () => {
  for (const t of ['Oi Ana, vi que a clínica abriu há pouco. Faz sentido conversarmos 30 minutos?', 'Posso te mandar um exemplo?', 'Quinta às 15h funciona?', '']) {
    assertEquals(palavrasProibidas(t), [], t)
  }
})

Deno.test('conduta: só vale a palavra inteira (não marca "garantidora" nem "sinergias de rotina" por engano)', () => {
  assertEquals(palavrasProibidas('A empresa garantidora do contrato'), [])
})
