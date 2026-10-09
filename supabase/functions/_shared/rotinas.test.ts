// deno-lint-ignore-file no-explicit-any
import { assertEquals } from 'jsr:@std/assert@1'
import { enviarResumosDiarios, snapshotMetricas } from './rotinas.ts'

/** Banco que explode se for tocado: prova que a janela de horário bloqueia antes de qualquer consulta. */
const intocavel: any = new Proxy({}, { get: () => { throw new Error('não deveria consultar o banco') } })

const brt = (iso: string) => new Date(`${iso}-03:00`)

Deno.test('resumo diário: não roda no fim de semana nem antes das 9h (Brasília)', async () => {
  assertEquals(await enviarResumosDiarios(intocavel, brt('2026-10-10T10:00:00')), {}) // sábado
  assertEquals(await enviarResumosDiarios(intocavel, brt('2026-10-11T10:00:00')), {}) // domingo
  assertEquals(await enviarResumosDiarios(intocavel, brt('2026-10-12T08:59:00')), {}) // segunda, cedo
})

Deno.test('resumo diário: em dia útil depois das 9h consulta as integrações configuradas', async () => {
  let consultou = ''
  const sb: any = {
    from(t: string) {
      consultou = t
      const q: any = { select: () => q, eq: () => q, then: (r: any) => r({ data: [], error: null }) }
      return q
    },
  }
  assertEquals(await enviarResumosDiarios(sb, brt('2026-10-12T09:00:00')), {})
  assertEquals(consultou, 'integracoes')
})

Deno.test('snapshot das métricas: só no primeiro ciclo de cada hora', async () => {
  assertEquals(await snapshotMetricas(intocavel, new Date('2026-10-12T12:30:00Z')), 'fora da janela')
  const sb: any = { rpc: () => Promise.resolve({ data: 2, error: null }) }
  assertEquals(await snapshotMetricas(sb, new Date('2026-10-12T12:05:00Z')), '2 campanha(s)')
  const ruim: any = { rpc: () => Promise.resolve({ data: null, error: { message: 'boom' } }) }
  assertEquals(await snapshotMetricas(ruim, new Date('2026-10-12T12:05:00Z')), 'erro: boom')
})
