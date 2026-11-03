import { assertEquals } from 'jsr:@std/assert@1'
import { telefoneCanonico } from './telefone.ts'

// Tabela de casos combinada com o CRM (contrato Maestro ↔ CRM). A mesma tabela roda em SQL em `supabase/sql/teste_telefone.sql`.
export const CASOS_TELEFONE: [string | null, string | null][] = [
  ['(11) 98765-4321', '5511987654321'],
  ['11987654321', '5511987654321'],
  ['+55 11 98765-4321', '5511987654321'],
  ['5511987654321', '5511987654321'],
  ['551187654321', '5511987654321'],
  ['1187654321', '5511987654321'],
  ['55 (11) 8765-4321', '5511987654321'],
  ['(11) 3456-7890', '551134567890'],
  ['551134567890', '551134567890'],
  ['0 11 98765-4321', '5511987654321'],
  ['005511987654321', '5511987654321'],
  ['55 55 98765-4321', '5555987654321'],
  ['55987654321', '5555987654321'],
  ['5511987654321@s.whatsapp.net', '5511987654321'],
  ['551187654321@s.whatsapp.net', '5511987654321'],
  ['+1 415 555 2671', '14155552671'],
  ['98765-4321', null],
  ['12345', null],
  ['', null],
  // além da tabela do CRM: JID com dispositivo, nulo e lixo
  ['5511987654321:12@s.whatsapp.net', '5511987654321'],
  [null, null],
  ['abc', null],
]

Deno.test('telefoneCanonico: tabela de casos do contrato com o CRM', () => {
  for (const [entrada, saida] of CASOS_TELEFONE) assertEquals(telefoneCanonico(entrada), saida, `entrada: ${JSON.stringify(entrada)}`)
})

Deno.test('telefoneCanonico: com e sem o 9º dígito dá o mesmo número (comparação), DDD diferente dá número diferente', () => {
  assertEquals(telefoneCanonico('551187654321'), telefoneCanonico('5511987654321'))
  // mesmo final de número em cidades diferentes não pode virar a mesma pessoa
  assertEquals(telefoneCanonico('5511987654321') === telefoneCanonico('5521987654321'), false)
})
