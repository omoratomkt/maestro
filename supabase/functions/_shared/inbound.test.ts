// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { fakeSb } from './fake_sb.ts'
import { handleInbound } from './inbound.ts'

const prospect = { id: 'p1', workspace_id: 'ws1', status: 'engajado', whatsapp: '5511999998888', email: null, linkedin_url: null, instagram_handle: null, website: null }

Deno.test('opt-out por palavra-chave: suprime e descarta sem chamar o modelo', async () => {
  const { sb, chamadas } = fakeSb({ prospects: [prospect], prospect_interacoes: [{ id: 'i1' }] })
  const r = await handleInbound(sb, { workspace_id: 'ws1', canal: 'whatsapp', quem: { whatsapp: '5511999998888' }, texto: 'Quero sair da lista, por favor' })

  assertEquals(r.proximo, 'suprimido')
  assertEquals(r.triagem, 'opt_out')
  // o modelo nunca foi chamado: nem credencial da Anthropic nem registro de custo foram tocados
  assert(!chamadas.some((c) => c.tabela === 'integracoes' || c.tabela === 'custos_uso'), 'não pode tocar no modelo')
  // entrou na lista de supressão do workspace
  const supressao = chamadas.find((c) => c.tabela === 'supressoes' && c.op === 'upsert')
  assert(supressao, 'deve registrar na lista de supressão')
  assertEquals(supressao.args[0].some((l: any) => l.tipo === 'whatsapp' && l.workspace_id === 'ws1'), true)
  // prospect descartado e ações abertas canceladas
  assert(chamadas.some((c) => c.tabela === 'prospects' && c.op === 'update' && c.args[0].status === 'descartado'))
  assert(chamadas.some((c) => c.tabela === 'fila_acoes' && c.op === 'update' && c.args[0].status === 'cancelada'))
})

Deno.test('opt-out por palavra-chave: contato desconhecido não gera supressão', async () => {
  const { sb, chamadas } = fakeSb({ prospects: [] })
  const r = await handleInbound(sb, { workspace_id: 'ws1', canal: 'whatsapp', quem: { whatsapp: '5511999998888' }, texto: 'me remove da lista' })
  assertEquals(r.encontrado, false)
  assert(!chamadas.some((c) => c.tabela === 'supressoes'))
})

const tocouNoModelo = (chamadas: { tabela: string; op: string; args: any[] }[]) =>
  chamadas.some((c) => c.tabela === 'custos_uso' || (c.tabela === 'integracoes' && c.args.includes('anthropic')))

Deno.test('escalada: áudio pausa o agente e chama uma pessoa, sem chamar o modelo', async () => {
  const { sb, chamadas } = fakeSb({ prospects: [prospect], prospect_interacoes: [{ id: 'i1' }] })
  const r = await handleInbound(sb, { workspace_id: 'ws1', canal: 'whatsapp', quem: { whatsapp: '5511999998888' }, texto: '[áudio]', tipo: 'audio' })
  assertEquals(r.proximo, 'aguardando humano')
  assert(!tocouNoModelo(chamadas))
  const estado = chamadas.find((c) => c.tabela === 'prospect_estado' && c.op === 'upsert')
  assertEquals(estado?.args[0].aguardando, 'nenhum')
  assertEquals(estado?.args[0].proxima_acao_em, null)
})

Deno.test('escalada: pedido jurídico pausa o agente, sem chamar o modelo e sem descadastrar', async () => {
  const { sb, chamadas } = fakeSb({ prospects: [prospect], prospect_interacoes: [{ id: 'i1' }] })
  const r = await handleInbound(sb, { workspace_id: 'ws1', canal: 'whatsapp', quem: { whatsapp: '5511999998888' }, texto: 'Vou procurar meu advogado sobre isso' })
  assertEquals(r.proximo, 'aguardando humano')
  assert(!tocouNoModelo(chamadas))
  assert(!chamadas.some((c) => c.tabela === 'supressoes'), 'escalar não é descadastrar')
})

Deno.test('ligação pelo número completo: com e sem o 9º dígito e com JID chegam ao mesmo valor, nunca só o final', async () => {
  for (const numero of ['5511999998888', '551199998888', '11999998888', '5511999998888:12@s.whatsapp.net']) {
    const { sb, chamadas } = fakeSb({ prospects: [prospect], prospect_interacoes: [{ id: 'i1' }] })
    await handleInbound(sb, { workspace_id: 'ws1', canal: 'whatsapp', quem: { whatsapp: numero }, texto: 'Quero sair da lista' })
    const busca = chamadas.find((c) => c.tabela === 'prospects' && c.op === 'eq' && c.args[0] === 'whatsapp_normalizado')
    assertEquals(busca?.args[1], '5511999998888', numero)
    assert(!chamadas.some((c) => c.tabela === 'prospects' && c.op === 'like'), 'não pode comparar pelo final do número')
  }
})

Deno.test('ligação pelo número completo: número inválido não procura ninguém', async () => {
  const { sb, chamadas } = fakeSb({ prospects: [prospect] })
  const r = await handleInbound(sb, { workspace_id: 'ws1', canal: 'whatsapp', quem: { whatsapp: '12345' }, texto: 'oi' })
  assertEquals(r.encontrado, false)
  assert(!chamadas.some((c) => c.tabela === 'prospects' && c.op === 'eq' && c.args[0] === 'whatsapp_normalizado'))
})

Deno.test('mensagem não gravada: avisa que é para tentar de novo e não trata nada', async () => {
  const { sb, chamadas } = fakeSb({ prospects: [prospect], prospect_interacoes: [] }, { erros: { 'prospect_interacoes:insert': 'banco fora do ar' } })
  const r = await handleInbound(sb, { workspace_id: 'ws1', canal: 'whatsapp', quem: { whatsapp: '5511999998888' }, texto: 'oi', message_id: 'm1' })
  assertEquals(r.retentar, true)
  assert(!chamadas.some((c) => c.tabela === 'supressoes' || c.tabela === 'prospect_estado'), 'nada é tratado sem a mensagem gravada')
})

const jaGravada = (metadata: Record<string, unknown>) => ({ prospects: [prospect], prospect_interacoes: [{ id: 'i1', metadata: { message_id: 'm1', ...metadata } }] })
const msgRepetida = { workspace_id: 'ws1', canal: 'whatsapp' as const, quem: { whatsapp: '5511999998888' }, texto: 'Quero sair da lista', message_id: 'm1' }

Deno.test('mensagem repetida pelo provedor: ignorada, mesmo que o tratamento tenha parado no meio', async () => {
  const { sb, chamadas } = fakeSb(jaGravada({}))
  const r = await handleInbound(sb, msgRepetida)
  assertEquals(r.duplicada, true)
  assert(!chamadas.some((c) => c.tabela === 'supressoes'))
})

Deno.test('reprocessamento: retoma a mensagem gravada cujo tratamento não terminou (sem triagem), sem gravar de novo', async () => {
  const { sb, chamadas } = fakeSb(jaGravada({}))
  const r = await handleInbound(sb, { ...msgRepetida, retomar: true })
  assertEquals(r.proximo, 'suprimido') // o pedido de saída que ficou pela metade é aplicado agora
  assert(!chamadas.some((c) => c.tabela === 'prospect_interacoes' && c.op === 'insert'), 'não pode duplicar a mensagem')
  assert(chamadas.some((c) => c.tabela === 'supressoes' && c.op === 'upsert'))
})

Deno.test('reprocessamento: mensagem cujo tratamento terminou (tem triagem) não é tratada duas vezes', async () => {
  const { sb, chamadas } = fakeSb(jaGravada({ triagem: { intencao: 'interesse', resumo: 'x' } }))
  const r = await handleInbound(sb, { ...msgRepetida, retomar: true })
  assertEquals(r.duplicada, true)
  assert(!chamadas.some((c) => c.tabela === 'supressoes' || c.tabela === 'fila_acoes'))
})
