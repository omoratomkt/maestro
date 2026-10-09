import { assertEquals } from 'jsr:@std/assert@1'
import { inicioDoDiaBrt } from './limites.ts'

Deno.test('inicioDoDiaBrt: meia-noite de Brasília como instante UTC', () => {
  // 2026-10-08 02:30Z ainda é 07/10 23:30 em Brasília → o dia começou em 07/10 00:00 BRT (03:00Z)
  assertEquals(inicioDoDiaBrt(new Date('2026-10-08T02:30:00Z')).toISOString(), '2026-10-07T03:00:00.000Z')
  // 2026-10-08 03:00Z já é 08/10 00:00 BRT
  assertEquals(inicioDoDiaBrt(new Date('2026-10-08T03:00:00Z')).toISOString(), '2026-10-08T03:00:00.000Z')
  assertEquals(inicioDoDiaBrt(new Date('2026-10-08T20:00:00Z')).toISOString(), '2026-10-08T03:00:00.000Z')
})
