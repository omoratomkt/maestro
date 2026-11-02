// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals } from 'jsr:@std/assert@1'
import { ERRO_HORARIO, executeAction } from './execute.ts'
import { fakeSb } from './fake_sb.ts'
import { dentroDoHorarioComercial } from './util.ts'

// Horários dados em UTC; Brasília = UTC−3. 2026-11-02 é segunda-feira.
const utc = (s: string) => new Date(`${s}Z`)

Deno.test('dentroDoHorarioComercial: seg–sex, 9h às 18h de Brasília', () => {
  assertEquals(dentroDoHorarioComercial(utc('2026-11-02T12:00:00')), true) // seg 09:00 BRT
  assertEquals(dentroDoHorarioComercial(utc('2026-11-02T20:59:00')), true) // seg 17:59 BRT
  assertEquals(dentroDoHorarioComercial(utc('2026-11-02T11:59:00')), false) // seg 08:59 BRT
  assertEquals(dentroDoHorarioComercial(utc('2026-11-02T21:00:00')), false) // seg 18:00 BRT
  assertEquals(dentroDoHorarioComercial(utc('2026-11-02T01:00:00')), false) // dom 22:00 BRT
  assertEquals(dentroDoHorarioComercial(utc('2026-11-07T15:00:00')), false) // sábado
  assertEquals(dentroDoHorarioComercial(utc('2026-11-08T15:00:00')), false) // domingo
  assertEquals(dentroDoHorarioComercial(utc('2026-11-06T20:00:00')), true) // sex 17:00 BRT
})

const acao = { id: 'f1', prospect_id: 'p1', campanha_id: 'c1', canal: 'whatsapp', mensagem: 'Oi!', mensagem_editada: null, tipo: 'followup', status: 'aprovada' }
const prospect = { id: 'p1', workspace_id: 'ws1', fonte: 'google_places', status: 'em_contato', whatsapp: '5511999998888', email: null }

Deno.test('envio fora do horário comercial: não envia, não marca erro e a ação segue aprovada', async () => {
  const { sb, chamadas } = fakeSb({ fila_acoes: [acao], prospects: [prospect], campanhas: [{ canais: ['whatsapp_evolution'] }], supressoes: [] })
  const r = await executeAction(sb, 'f1', utc('2026-11-07T15:00:00')) // sábado
  assertEquals(r.ok, false)
  assert(r.detalhe.startsWith(ERRO_HORARIO), r.detalhe)
  // nada saiu: nenhuma credencial de canal foi lida e nenhuma interação foi registrada
  assert(!chamadas.some((c) => c.tabela === 'integracoes'), 'não pode chegar ao provedor')
  assert(!chamadas.some((c) => c.tabela === 'prospect_interacoes' && c.op === 'insert'), 'não pode registrar envio')
  // o claim foi devolvido sem erro, para o agent-loop pegar na próxima janela
  const devolveu = chamadas.filter((c) => c.tabela === 'fila_acoes' && c.op === 'update').pop()
  assertEquals(devolveu?.args[0], { executada_em: null, erro_execucao: null })
  assert(!chamadas.some((c) => c.tabela === 'fila_acoes' && c.op === 'update' && c.args[0].status === 'executada'))
})

Deno.test('envio de demonstração não depende do horário', async () => {
  const { sb, chamadas } = fakeSb({ fila_acoes: [acao], prospects: [{ ...prospect, fonte: 'demo' }], campanhas: [{ canais: ['whatsapp_evolution'] }], prospect_estado: [{}] })
  const r = await executeAction(sb, 'f1', utc('2026-11-07T15:00:00')) // sábado
  assertEquals(r.ok, true)
  assert(chamadas.some((c) => c.tabela === 'fila_acoes' && c.op === 'update' && c.args[0].status === 'executada'))
})

Deno.test('interruptor geral da IA: o envio automático fica parado, o aprovado por uma pessoa segue', async () => {
  const pausada = [{ valor: { pausada: true } }]
  // automático (veio de um fluxo): não sai e o claim é devolvido sem erro
  const auto = fakeSb({ fila_acoes: [{ ...acao, fluxo_automatico_id: 'fx1' }], prospects: [prospect], campanhas: [{ canais: ['whatsapp_evolution'] }], plataforma_config: pausada })
  const r1 = await executeAction(auto.sb, 'f1', utc('2026-11-02T15:00:00'))
  assertEquals(r1.ok, false)
  assert(r1.detalhe.includes('IA pausada'), r1.detalhe)
  assert(!auto.chamadas.some((c) => c.tabela === 'prospect_interacoes' && c.op === 'insert'))
  assertEquals(auto.chamadas.filter((c) => c.tabela === 'fila_acoes' && c.op === 'update').pop()?.args[0], { executada_em: null, erro_execucao: null })

  // aprovado por uma pessoa (sem fluxo): o interruptor não o segura (aqui, demonstração, para não chamar canal algum)
  const humano = fakeSb({ fila_acoes: [acao], prospects: [{ ...prospect, fonte: 'demo' }], campanhas: [{ canais: ['whatsapp_evolution'] }], prospect_estado: [{}], plataforma_config: pausada })
  const r2 = await executeAction(humano.sb, 'f1', utc('2026-11-02T15:00:00'))
  assertEquals(r2.ok, true)
})
