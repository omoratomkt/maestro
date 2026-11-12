import assert from 'node:assert/strict'
import test from 'node:test'
import { conferir, consultas, temFiltro } from './auditar-consultas.mjs'

const achar = (codigo) => consultas(codigo).map((c) => ({ ...c, arquivo: 'x.ts' }))

test('consulta com workspace_id passa', () => {
  const [c] = achar(`const { data } = await sb.from('prospects').select('*').eq('workspace_id', ws).limit(1)`)
  assert.equal(temFiltro(c), true)
})

test('consulta presa a um registro já autorizado passa', () => {
  const [c] = achar(`await sb.from('prospects').select('*').eq('id', prospect_id).maybeSingle()`)
  assert.equal(temFiltro(c), true)
})

test('leitura em tabela de cliente sem filtro reprova', () => {
  const [c] = achar(`const { data } = await sb.from('prospects').select('*').eq('status', 'novo')`)
  assert.equal(c.tabela, 'prospects')
  assert.equal(temFiltro(c), false)
})

test('alteração sem filtro reprova', () => {
  const [c] = achar(`await sb.from('fila_acoes').update({ status: 'cancelada' }).eq('status', 'pendente')`)
  assert.equal(temFiltro(c), false)
})

test('insert não entra na auditoria (o destino vem do registro autorizado)', () => {
  const [c] = achar(`await sb.from('fila_acoes').insert({ ...base, status: 'pendente' })`)
  assert.equal(temFiltro(c), true)
})

test('tabela que não é de cliente é ignorada', () => {
  assert.equal(achar(`await sb.from('ciclo_log').select('*')`).length, 0)
})

test('consulta em várias linhas é lida inteira', () => {
  const [c] = achar(`const r = await sb
    .from('custos_uso')
    .select('custo_usd')
    .eq('workspace_id', ws)
    .limit(10)`)
  assert.equal(temFiltro(c), true)
})

test('conferir: consulta nova reprova e exceção sem uso também', () => {
  const sem = [{ arquivo: 'a.ts', tabela: 'prospects' }]
  assert.equal(conferir(sem, []).novas.length, 1)
  assert.equal(conferir(sem, [{ arquivo: 'a.ts', tabela: 'prospects' }]).novas.length, 0)
  assert.equal(conferir([], [{ arquivo: 'a.ts', tabela: 'prospects' }]).obsoletas.length, 1)
})
