import { assertEquals } from 'jsr:@std/assert@1'
import { ehOptOut } from './optout.ts'

Deno.test('descadastro: palavras e frases curtas, com qualquer caixa, pontuação e com ou sem acento', () => {
  for (const t of ['PARAR', 'Parar!', 'stop', 'sair', 'pare de me mandar mensagem', 'não quero mais', 'NAO QUERO MAIS', 'por favor, remover', 'remover.', 'Pare.']) {
    assertEquals(ehOptOut(t), true, t)
  }
})

Deno.test('descadastro: frases de saída em qualquer parte da mensagem', () => {
  for (const t of [
    'quero sair da lista', 'Gostaria de sair dessa lista, obrigado', 'me remove da lista', 'por favor me remova',
    'me tira da lista', 'não quero receber mais mensagens', 'nao quero receber isso', 'para de me mandar mensagem',
    'parem de me enviar mensagens', 'pode tirar meu número da lista?', 'quero remover meu contato', 'descadastra meu numero',
    'não me chame mais, por favor', 'vou denunciar vocês',
    'Olá, boa tarde! Tudo bem? Sei que vocês estão só fazendo o trabalho de vocês, mas por favor me tire da lista de contatos e nunca mais me envie nada, obrigado',
  ]) {
    assertEquals(ehOptOut(t), true, t)
  }
})

Deno.test('descadastro: conversa normal não é pedido para sair', () => {
  for (const t of [
    'Vou parar para pensar', 'quero saber mais', 'pode me explicar melhor?', 'qual o valor?', 'me manda o link da reunião',
    'adorei, vamos marcar', 'estou saindo agora, falo depois', 'a lista de preços está certa?', '', '   ',
    'vocês seguem a LGPD?',
    'Pode ser amanhã de manhã? Eu preciso sair mais cedo hoje por causa de uma reunião com o contador que marquei antes',
  ]) {
    assertEquals(ehOptOut(t), false, t)
  }
})

Deno.test('descadastro: palavra curta só vale em mensagem curta (não derruba conversa longa)', () => {
  assertEquals(ehOptOut('podemos conversar na semana que vem sobre o projeto porque agora tenho que parar'), false)
  assertEquals(ehOptOut('ok, pare'), true)
})
