import { assertEquals } from 'jsr:@std/assert@1'
import { ehMensagemNaoTextual, motivoDeEscalada } from './escalada.ts'

Deno.test('escalada: assunto jurídico, reclamação e pedido de uma pessoa', () => {
  assertEquals(motivoDeEscalada('Vou falar com meu advogado'), 'assunto jurídico')
  assertEquals(motivoDeEscalada('isso é golpe!'), 'reclamação ou denúncia')
  assertEquals(motivoDeEscalada('Quero fazer uma RECLAMAÇÃO no Procon'), 'assunto jurídico')
  assertEquals(motivoDeEscalada('quero falar com uma pessoa, por favor'), 'pediu para falar com uma pessoa')
  assertEquals(motivoDeEscalada('pode me passar para um atendente humano?'), 'pediu para falar com uma pessoa')
})

Deno.test('escalada: conversa comercial normal não escala', () => {
  for (const t of ['Pode ser quinta às 15h?', 'quanto custa?', 'vocês são uma IA?', 'me manda mais detalhes', 'estou em reunião, falo depois', '', '  ']) {
    assertEquals(motivoDeEscalada(t), null, t)
  }
})

Deno.test('mensagem não textual: áudio, imagem e documento', () => {
  for (const t of ['audio', 'image', 'document']) assertEquals(ehMensagemNaoTextual(t), true, t)
  for (const t of ['text', undefined, '']) assertEquals(ehMensagemNaoTextual(t), false, String(t))
})
