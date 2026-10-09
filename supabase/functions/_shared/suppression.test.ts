import { assertEquals } from 'jsr:@std/assert@1'
import { chavesDe, estaSuprimido, normalizar } from './suppression.ts'

Deno.test('normalizar por tipo', () => {
  assertEquals(normalizar('email', '  Ana@Empresa.COM '), 'ana@empresa.com')
  assertEquals(normalizar('dominio', 'https://www.Empresa.com.br/contato'), 'empresa.com.br')
  assertEquals(normalizar('whatsapp', '(11) 91234-5678'), '5511912345678')
  assertEquals(normalizar('linkedin', 'https://www.linkedin.com/in/Ana-Souza/'), 'ana-souza')
  assertEquals(normalizar('instagram', '@Clinica_X'), 'clinica_x')
})

Deno.test('estaSuprimido: email, domínio, whatsapp (com/sem DDI e 9º dígito), linkedin e instagram', () => {
  const lista = new Set(['email:ana@x.com', 'dominio:bloqueada.com.br', 'whatsapp:12345678', 'linkedin:joao-lima', 'instagram:clinica_x'])
  assertEquals(estaSuprimido(lista, { email: 'ANA@x.com' }), true)
  assertEquals(estaSuprimido(lista, { email: 'outra@x.com' }), false)
  assertEquals(estaSuprimido(lista, { email: 'qualquer@bloqueada.com.br' }), true)
  assertEquals(estaSuprimido(lista, { website: 'https://www.bloqueada.com.br/' }), true)
  // Mesmo número em formatos diferentes (com DDI e 9º dígito, ou sem): os 8 últimos dígitos coincidem.
  assertEquals(estaSuprimido(lista, { whatsapp: '+55 11 9 1234-5678' }), true)
  assertEquals(estaSuprimido(lista, { whatsapp: '(11) 1234-5678' }), true)
  assertEquals(estaSuprimido(lista, { whatsapp: '11 2345-5678' }), false)
  assertEquals(estaSuprimido(lista, { linkedin_url: 'https://linkedin.com/in/joao-lima/' }), true)
  assertEquals(estaSuprimido(lista, { instagram_handle: '@Clinica_X' }), true)
  assertEquals(estaSuprimido(lista, {}), false)
})

Deno.test('chavesDe: domínio entra pelo email e pelo site', () => {
  assertEquals(chavesDe({ email: 'a@b.com', website: 'www.c.com' }).sort(), ['dominio:b.com', 'dominio:c.com', 'email:a@b.com'].sort())
})
