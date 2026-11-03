// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { esperaMinutos, executarEvento, MAX_TENTATIVAS, reprocessarEventos, registrarEvento } from './eventos.ts'
import { fakeSb } from './fake_sb.ts'
import { processarEvento, processarWhatsapp } from './processadores.ts'

const evolution = (over: Record<string, any> = {}) =>
  JSON.stringify({ event: 'messages.upsert', data: { key: { remoteJid: '551187654321@s.whatsapp.net', fromMe: false, id: 'ABC' }, message: { conversation: 'oi' }, ...over } })

const atualizacoes = (chamadas: { tabela: string; op: string; args: any[] }[]) => chamadas.filter((c) => c.tabela === 'eventos_recebidos' && c.op === 'update').map((c) => c.args[0])

Deno.test('registrarEvento: grava o corpo bruto antes de tudo', async () => {
  const { sb, chamadas } = fakeSb({ eventos_recebidos: [{ id: 'e1' }] })
  const ev = await registrarEvento(sb, 'ws1', 'whatsapp', '{"a":1}')
  assertEquals(ev.id, 'e1')
  const ins = chamadas.find((c) => c.tabela === 'eventos_recebidos' && c.op === 'insert')
  assertEquals(ins?.args[0], { workspace_id: 'ws1', canal: 'whatsapp', corpo_bruto: '{"a":1}' })
})

Deno.test('registrarEvento: se não gravar, lança (o webhook responde erro e o provedor reenvia)', async () => {
  const { sb } = fakeSb({ eventos_recebidos: [] }, { erros: { 'eventos_recebidos:insert': 'sem espaço' } })
  await assertRejects(() => registrarEvento(sb, 'ws1', 'whatsapp', '{}'), Error, 'Falha ao registrar o evento recebido')
})

Deno.test('executarEvento: sucesso marca processado, guarda o resultado e apaga o corpo', async () => {
  const { sb, chamadas } = fakeSb({ prospects: [] })
  const r = await executarEvento(sb, { id: 'e1', workspace_id: 'ws1', canal: 'whatsapp', corpo_bruto: evolution(), tentativas: 0 })
  assertEquals(r, 'processado')
  const [u] = atualizacoes(chamadas)
  assertEquals(u.status, 'processado')
  assertEquals(u.corpo_bruto, null)
  assertEquals(u.tentativas, 1)
  assert(String(u.resultado).includes('sem_prospect=1'), u.resultado)
})

Deno.test('executarEvento: falha guarda o erro e agenda a próxima tentativa, mantendo o corpo', async () => {
  const { sb, chamadas } = fakeSb({})
  const antes = Date.now()
  const r = await executarEvento(sb, { id: 'e1', workspace_id: 'ws1', canal: 'whatsapp', corpo_bruto: null, tentativas: 0 })
  assertEquals(r, 'erro')
  const [u] = atualizacoes(chamadas)
  assertEquals(u.status, 'erro')
  assertEquals(u.tentativas, 1)
  assert(!('corpo_bruto' in u), 'o corpo precisa continuar guardado para a nova tentativa')
  const espera = new Date(u.proxima_tentativa_em).getTime() - antes
  assert(espera >= 5 * 60e3 - 1000 && espera <= 5 * 60e3 + 5000, `espera de ${espera} ms`)
})

Deno.test('executarEvento: na última tentativa vira "falhou" e o operador é avisado', async () => {
  const { sb, chamadas } = fakeSb({})
  const r = await executarEvento(sb, { id: 'e1', workspace_id: 'ws1', canal: 'whatsapp', corpo_bruto: null, tentativas: MAX_TENTATIVAS })
  assertEquals(r, 'falhou')
  assertEquals(atualizacoes(chamadas)[0].status, 'falhou')
  assert(chamadas.some((c) => c.tabela === 'integracoes'), 'tentou avisar pelo email do operador')
})

Deno.test('espera cresce a cada tentativa', () => {
  assertEquals([1, 2, 3, 4].map(esperaMinutos), [5, 15, 45, 135])
})

Deno.test('reprocessarEventos: reserva a tentativa, retoma e conclui o que estava parado', async () => {
  const parado = { id: 'e1', workspace_id: 'ws1', canal: 'whatsapp', corpo_bruto: evolution(), tentativas: 0, proxima_tentativa_em: '2026-11-03T10:00:00Z' }
  const { sb, chamadas } = fakeSb({ eventos_recebidos: [parado], prospects: [] })
  const rel = await reprocessarEventos(sb)
  assertEquals(rel.tentados, 1)
  assertEquals(rel.processados, 1)
  const ups = atualizacoes(chamadas)
  assert(ups.some((u) => u.tentativas === 1 && 'proxima_tentativa_em' in u && !('status' in u)), 'reservou a tentativa antes de rodar')
  assert(ups.some((u) => u.status === 'processado' && u.corpo_bruto === null))
})

Deno.test('reprocessarEventos: sem tempo sobrando não começa outro', async () => {
  const parado = { id: 'e1', workspace_id: 'ws1', canal: 'whatsapp', corpo_bruto: evolution(), tentativas: 0, proxima_tentativa_em: '2026-11-03T10:00:00Z' }
  const { sb } = fakeSb({ eventos_recebidos: [parado], prospects: [] })
  const rel = await reprocessarEventos(sb, { temTempo: () => false })
  assertEquals(rel.tentados, 0)
})

Deno.test('processarWhatsapp (Evolution): mensagem de número desconhecido é contada, nada é criado', async () => {
  const { sb, chamadas } = fakeSb({ prospects: [] })
  const r = await processarWhatsapp(sb, 'ws1', JSON.parse(evolution()), {})
  assert(r.includes('sem_prospect=1'), r)
  assert(!chamadas.some((c) => c.op === 'insert'), 'não cria prospect nem interação')
})

Deno.test('processarWhatsapp (Evolution): mensagem enviada por nós e grupos são ignorados', async () => {
  const { sb, chamadas } = fakeSb({ prospects: [] })
  const nossa = await processarWhatsapp(sb, 'ws1', JSON.parse(evolution({ key: { remoteJid: '551187654321@s.whatsapp.net', fromMe: true, id: 'X' } })), {})
  const grupo = await processarWhatsapp(sb, 'ws1', JSON.parse(evolution({ key: { remoteJid: '120363@g.us', fromMe: false, id: 'Y' } })), {})
  assert(nossa.includes('ignoradas=1') && grupo.includes('ignoradas=1'), `${nossa} | ${grupo}`)
  assert(!chamadas.some((c) => c.tabela === 'prospects'), 'nem procura prospect')
})

Deno.test('processarWhatsapp: mensagem que não pôde ser gravada lança (o evento volta para a fila)', async () => {
  const prospect = { id: 'p1', workspace_id: 'ws1', status: 'engajado', whatsapp: '5511987654321', email: null, linkedin_url: null, instagram_handle: null, website: null }
  const { sb } = fakeSb({ prospects: [prospect], prospect_interacoes: [] }, { erros: { 'prospect_interacoes:insert': 'banco fora do ar' } })
  await assertRejects(() => processarWhatsapp(sb, 'ws1', JSON.parse(evolution()), {}), Error, 'Mensagem não gravada')
})

Deno.test('processarEvento: corpo ausente ou que não é JSON lança', async () => {
  const { sb } = fakeSb({})
  await assertRejects(() => processarEvento(sb, 'ws1', 'email', null), Error, 'sem corpo')
  await assertRejects(() => processarEvento(sb, 'ws1', 'email', '{quebrado'), Error, 'não é JSON')
})

Deno.test('processarEvento: email fora de reply_received é ignorado', async () => {
  const { sb } = fakeSb({})
  assertEquals(await processarEvento(sb, 'ws1', 'email', JSON.stringify({ event_type: 'email_sent' })), 'ignorado')
})
