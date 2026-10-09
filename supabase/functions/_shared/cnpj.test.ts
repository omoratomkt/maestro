import { assertEquals } from 'jsr:@std/assert@1'
import { cnpjValido, extrairCnpj } from './cnpj.ts'

Deno.test('cnpj: dígitos verificadores', () => {
  assertEquals(cnpjValido('11.222.333/0001-81'), true)
  assertEquals(cnpjValido('11222333000181'), true)
  assertEquals(cnpjValido('11.222.333/0001-82'), false)
  assertEquals(cnpjValido('11111111111111'), false)
  assertEquals(cnpjValido('123'), false)
})

Deno.test('cnpj: extrai do rodapé do site', () => {
  assertEquals(extrairCnpj('<footer><p>Clínica X - CNPJ 11.222.333/0001-81 - Rua A</p></footer>'), '11222333000181')
  assertEquals(extrairCnpj('<p>CNPJ: 11222333000181</p>'), '11222333000181')
})

Deno.test('cnpj: ignora números que não são CNPJ', () => {
  assertEquals(extrairCnpj('<p>Tel 11222333000181 whatsapp</p>'), null)
  assertEquals(extrairCnpj('<p>CNPJ 11.222.333/0001-82</p>'), null)
  assertEquals(extrairCnpj('sem nada'), null)
})
