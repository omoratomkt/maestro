import { assert, assertEquals } from 'jsr:@std/assert@1'
import { excedeuLimiteDeNovos, MAX_NOVOS_POR_HORA, texto } from './entrada_publica.ts'

Deno.test('texto: corta, limpa e rejeita o que não é texto', () => {
  assertEquals(texto('  Ana  ', 10), 'Ana')
  assertEquals(texto('a'.repeat(500), 200)?.length, 200)
  assertEquals(texto('   ', 10), null)
  assertEquals(texto(123, 10), null)
  assertEquals(texto({ x: 1 }, 10), null)
  assertEquals(texto(null, 10), null)
})

// Banco falso: devolve a contagem pedida e registra os filtros da consulta.
function sbComContagem(count: number) {
  const filtros: unknown[][] = []
  const q: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') return (ok: (v: unknown) => unknown) => ok({ count, data: null, error: null })
      return (...args: unknown[]) => {
        filtros.push([prop, ...args])
        return q
      }
    },
  })
  return { sb: { from: () => q } as any, filtros }
}

Deno.test('excedeuLimiteDeNovos: bloqueia no limite e filtra por workspace, fonte e última hora', async () => {
  const agora = Date.parse('2026-11-02T15:00:00Z')
  const abaixo = sbComContagem(MAX_NOVOS_POR_HORA - 1)
  assertEquals(await excedeuLimiteDeNovos(abaixo.sb, 'ws1', agora), false)
  const noLimite = sbComContagem(MAX_NOVOS_POR_HORA)
  assertEquals(await excedeuLimiteDeNovos(noLimite.sb, 'ws1', agora), true)

  const filtros = noLimite.filtros
  assert(filtros.some((f) => f[0] === 'eq' && f[1] === 'workspace_id' && f[2] === 'ws1'))
  assert(filtros.some((f) => f[0] === 'eq' && f[1] === 'fonte' && f[2] === 'inbound'))
  assert(filtros.some((f) => f[0] === 'gte' && f[1] === 'criado_em' && f[2] === '2026-11-02T14:00:00.000Z'))
})
