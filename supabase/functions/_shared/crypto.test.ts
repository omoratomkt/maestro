import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { campoSensivel, cifrar, cifrarConfig, decifrar, decifrarConfig, estaCifrado } from './crypto.ts'

const CHAVE = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i + 1)))

Deno.test('crypto: ida e volta, e cada cifra é diferente', async () => {
  Deno.env.set('CREDENTIALS_KEY', CHAVE)
  const a = await cifrar('sk-segredo')
  const b = await cifrar('sk-segredo')
  assert(estaCifrado(a) && a !== b && !a.includes('sk-segredo'))
  assertEquals(await decifrar(a), 'sk-segredo')
})

Deno.test('crypto: só cifra campos sensíveis e é idempotente', async () => {
  Deno.env.set('CREDENTIALS_KEY', CHAVE)
  const cfg = { api_key: 'abc', webhook_secret: 'xyz', remetente: 'Maestro <a@b.com>', limiteDiario: 100 }
  const c = await cifrarConfig(cfg)
  assert(estaCifrado(c.api_key) && estaCifrado(c.webhook_secret))
  assertEquals(c.remetente, cfg.remetente)
  assertEquals(c.limiteDiario, 100)
  assertEquals(await cifrarConfig(c), c)
  assertEquals(await decifrarConfig(c), cfg)
})

Deno.test('crypto: texto puro antigo ainda é lido; chave errada falha', async () => {
  Deno.env.set('CREDENTIALS_KEY', CHAVE)
  assertEquals(await decifrarConfig({ api_key: 'antigo' }), { api_key: 'antigo' })
  const c = await cifrar('x')
  Deno.env.set('CREDENTIALS_KEY', btoa(String.fromCharCode(...new Uint8Array(32).fill(9))))
  await assertRejects(() => decifrar(c))
  assert(campoSensivel('app_secret') && campoSensivel('verify_token') && !campoSensivel('remetente'))
})
