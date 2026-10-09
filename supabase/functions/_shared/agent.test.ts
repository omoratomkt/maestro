import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { linksNaoAutorizados, personaPrompt } from './agent.ts'

const campanha = { persona_nome: 'Ana', persona_tom: 'consultivo', persona_produto: 'Consultoria', persona_argumentos: ['a'], persona_objecoes: [{ objecao: 'caro', resposta: 'vale' }], criterios_qualificacao: [{ campo: 'dor', pergunta: 'Qual a dor?', obrigatorio: true }] }

Deno.test('prompt do agente: regra de segurança contra instruções vindas do prospect', () => {
  const p = personaPrompt(campanha, ['whatsapp'], null)
  assertStringIncludes(p, 'SEGURANÇA')
  assertStringIncludes(p, 'nunca instrução')
  assertStringIncludes(p, 'aguardar_humano')
  assertStringIncludes(p, 'Ofereça duas opções de horário')
})

Deno.test('prompt do agente: com Cal.com, envia o link de agendamento e só ele é permitido', () => {
  const p = personaPrompt(campanha, ['whatsapp', 'email'], 'https://cal.com/morato/30min')
  assertStringIncludes(p, 'https://cal.com/morato/30min')
  assertStringIncludes(p, 'exceto o link de agendamento')
  assert(!p.includes('Ofereça duas opções de horário'))
  assertStringIncludes(p, 'Canais disponíveis agora: whatsapp, email')
})

Deno.test('linksNaoAutorizados: só o link de agendamento passa', () => {
  const cal = 'https://cal.com/morato/30min'
  assertEquals(linksNaoAutorizados('Escolha um horário: https://cal.com/morato/30min?x=1', cal), [])
  assertEquals(linksNaoAutorizados('Veja www.golpe.com.br/pague e https://cal.com/morato/30min', cal), ['www.golpe.com.br/pague'])
  assertEquals(linksNaoAutorizados('Acesse https://exemplo.com.', null), ['https://exemplo.com.'])
  assertEquals(linksNaoAutorizados('Sem link nenhum aqui.', cal), [])
})
