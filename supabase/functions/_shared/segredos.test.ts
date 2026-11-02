import { assert, assertEquals } from 'jsr:@std/assert@1'
import { mascarar, resumirParaLog } from './segredos.ts'

// Todos os valores abaixo são INVENTADOS, só com o formato de cada tipo. Nunca coloque um segredo real num teste.
// Os prefixos são montados em tempo de execução: assim o texto de um formato conhecido nunca aparece inteiro no arquivo
// (o scanner de segredos do GitHub bloqueia o push de qualquer coisa que pareça uma chave).
const montar = (prefixo: string, resto: string) => prefixo + resto
Deno.test('mascarar: um caso por formato, sem deixar o valor', () => {
  const casos: [string, string][] = [
    ['usei ' + montar('sk-' + 'ant-', 'api03-EXEMPLOEXEMPLO') + ' agora', 'chave Anthropic'],
    ['chave sk-proj1234567890exemploexemplo', 'chave de IA'],
    [montar('apify' + '_api_', 'EXEMPLO'.repeat(3)), 'chave Apify'],
    [montar('sbp' + '_', '0'.repeat(40)), 'token Supabase'],
    [montar('gh' + 'p_', 'exemplo'.repeat(5)), 'token GitHub'],
    [montar('AK' + 'IA', 'EXEMPLOEXEMPLO12'), 'chave AWS'],
    ['eyJexemploexemplo.eyJexemploexemplo.exemploexemploexemplo', 'JWT'],
    ['Authorization: Bearer exemploexemploexemploexemplo', 'Bearer'],
    ['-----BEGIN PRIVATE KEY-----\nEXEMPLOEXEMPLO\n-----END PRIVATE KEY-----', 'chave privada'],
  ]
  for (const [entrada, tipo] of casos) {
    const r = mascarar(entrada)
    assert(r.achados.includes(tipo), `${tipo}: ${JSON.stringify(r.achados)}`)
    assert(r.texto.includes('mascarado'), tipo)
  }
})

Deno.test('mascarar: "senha: valor" mantém o rótulo e some com o valor', () => {
  const r = mascarar('minha senha: ValorInventado1! e o token = valorinventado2')
  assert(!r.texto.includes('ValorInventado1'))
  assert(!r.texto.includes('valorinventado2'))
  assert(r.achados.includes('senha'))
})

Deno.test('mascarar: texto normal não é alterado', () => {
  for (const t of ['Oi, tudo bem? Vi que a clínica abriu em março.', 'Pode ser quinta às 15h? https://cal.com/morato/30min', 'Qual o valor do plano?', '']) {
    const r = mascarar(t)
    assertEquals(r.texto, t)
    assertEquals(r.achados, [])
  }
})

Deno.test('resumirParaLog: mascara e corta', () => {
  assertEquals(resumirParaLog(`${'a'.repeat(3000)} sk-ant-api03-EXEMPLOEXEMPLO`, 100).length, 100)
  assertEquals(resumirParaLog('chave sk-ant-api03-EXEMPLOEXEMPLO', 500).includes('sk-ant'), false)
})
