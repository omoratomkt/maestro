import { assert, assertEquals } from 'jsr:@std/assert@1'
import { PAPEIS, PROMPTS_FIXOS } from './papeis.ts'

Deno.test('papéis: cada papel tem descrição, e só o agente é editável', () => {
  assertEquals(PAPEIS.length, 5)
  assertEquals(PAPEIS.filter((p) => p.editavel).map((p) => p.papel), ['agent'])
  for (const p of PAPEIS) assert(p.funcao.length > 30 && p.nome.length > 3, p.papel)
})

Deno.test('papéis: todo prompt fixo trata o texto de terceiros como dado, nunca como instrução', () => {
  const papeis = Object.keys(PROMPTS_FIXOS)
  assertEquals(papeis.sort(), ['briefing', 'enrich', 'qualify', 'triage'])
  for (const [papel, prompt] of Object.entries(PROMPTS_FIXOS)) {
    assert(/nunca instru(ç|c)(ão|ões|ao|oes)/i.test(prompt ?? ''), `${papel} precisa da regra contra injeção de comando`)
  }
})
