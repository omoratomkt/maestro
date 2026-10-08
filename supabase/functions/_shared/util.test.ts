import { assertEquals } from 'jsr:@std/assert@1'
import { nextBusinessSlot, normalizePhone, timingSafeEqual } from './util.ts'

// Helpers: horários em Brasília (UTC−3) escritos como UTC "+3h".
const brt = (iso: string) => new Date(`${iso}-03:00`).toISOString()

Deno.test('nextBusinessSlot: dentro do expediente mantém o horário', () => {
  // segunda 2026-10-05 10:00 BRT + 2h = 12:00 BRT
  assertEquals(nextBusinessSlot(2, new Date(brt('2026-10-05T10:00:00'))).toISOString(), brt('2026-10-05T12:00:00'))
})

Deno.test('nextBusinessSlot: depois das 18h vai para o dia útil seguinte às 9h', () => {
  // quarta 17:30 + 2h = 19:30 → quinta 09:00
  assertEquals(nextBusinessSlot(2, new Date(brt('2026-10-07T17:30:00'))).toISOString(), brt('2026-10-08T09:00:00'))
})

Deno.test('nextBusinessSlot: sexta à tarde pula o fim de semana', () => {
  // sexta 2026-10-09 17:30 + 2h → segunda 09:00
  assertEquals(nextBusinessSlot(2, new Date(brt('2026-10-09T17:30:00'))).toISOString(), brt('2026-10-12T09:00:00'))
})

Deno.test('nextBusinessSlot: sábado e domingo caem na segunda às 9h', () => {
  assertEquals(nextBusinessSlot(1, new Date(brt('2026-10-10T12:00:00'))).toISOString(), brt('2026-10-12T09:00:00'))
  assertEquals(nextBusinessSlot(0, new Date(brt('2026-10-11T15:00:00'))).toISOString(), brt('2026-10-12T09:00:00'))
})

Deno.test('nextBusinessSlot: antes das 9h espera até as 9h do mesmo dia', () => {
  assertEquals(nextBusinessSlot(0, new Date(brt('2026-10-06T07:00:00'))).toISOString(), brt('2026-10-06T09:00:00'))
})

Deno.test('nextBusinessSlot: 48h a partir de quinta 16h cai em segunda', () => {
  // quinta 16:00 + 48h = sábado 16:00 → segunda 09:00
  assertEquals(nextBusinessSlot(48, new Date(brt('2026-10-08T16:00:00'))).toISOString(), brt('2026-10-12T09:00:00'))
})

Deno.test('normalizePhone', () => {
  assertEquals(normalizePhone('(11) 91234-5678'), '5511912345678')
  assertEquals(normalizePhone('+55 11 91234-5678'), '5511912345678')
  assertEquals(normalizePhone('1134567890'), '551134567890')
  assertEquals(normalizePhone('12345'), null)
  assertEquals(normalizePhone(null), null)
})

Deno.test('timingSafeEqual', () => {
  assertEquals(timingSafeEqual('abc', 'abc'), true)
  assertEquals(timingSafeEqual('abc', 'abd'), false)
  assertEquals(timingSafeEqual('abc', 'abcd'), false)
})
