import { assertEquals } from 'jsr:@std/assert@1'
import { inicioDoDiaBrt } from './limites.ts'

Deno.test('inicioDoDiaBrt: meia-noite de Brasília como instante UTC', () => {
  // 2026-10-08 02:30Z ainda é 07/10 23:30 em Brasília → o dia começou em 07/10 00:00 BRT (03:00Z)
  assertEquals(inicioDoDiaBrt(new Date('2026-10-08T02:30:00Z')).toISOString(), '2026-10-07T03:00:00.000Z')
  // 2026-10-08 03:00Z já é 08/10 00:00 BRT
  assertEquals(inicioDoDiaBrt(new Date('2026-10-08T03:00:00Z')).toISOString(), '2026-10-08T03:00:00.000Z')
  assertEquals(inicioDoDiaBrt(new Date('2026-10-08T20:00:00Z')).toISOString(), '2026-10-08T03:00:00.000Z')
})

Deno.test('nivelDoTeto: ok, alerta em 80% e bloqueio em 100%', async () => {
  const { nivelDoTeto } = await import('./limites.ts')
  assertEquals(nivelDoTeto(7.99, 10), 'ok')
  assertEquals(nivelDoTeto(8, 10), 'alerta80')
  assertEquals(nivelDoTeto(9.99, 10), 'alerta80')
  assertEquals(nivelDoTeto(10, 10), 'bloqueado')
  assertEquals(nivelDoTeto(50, 10), 'bloqueado')
  assertEquals(nivelDoTeto(5, 0), 'ok') // sem teto válido, não bloqueia
})
