// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { askClaude } from './anthropic.ts'

/** Banco de mentira: só o que askClaude usa (integracoes.maybeSingle e custos_uso.insert). */
function fakeSb() {
  const custos: any[] = []
  const sb: any = {
    from(table: string) {
      const q: any = {
        select: () => q,
        eq: () => q,
        maybeSingle: () => Promise.resolve({ data: table === 'integracoes' ? { ativo: true, config: { api_key: 'sk-test' } } : null, error: null }),
        insert: (row: any) => {
          custos.push(row)
          return Promise.resolve({ error: null })
        },
      }
      return q
    },
  }
  return { sb, custos }
}

function stubFetch(response: unknown, status = 200) {
  const calls: { url: string; body: any; headers: Headers }[] = []
  const original = globalThis.fetch
  globalThis.fetch = ((input: any, init?: any) => {
    calls.push({ url: String(input instanceof Request ? input.url : input), body: JSON.parse(init?.body ?? '{}'), headers: new Headers(init?.headers) })
    return Promise.resolve(new Response(JSON.stringify(response), { status, headers: { 'content-type': 'application/json' } }))
  }) as typeof fetch
  return { calls, restore: () => (globalThis.fetch = original) }
}

const message = (text: string, extra: any = {}) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-sonnet-5-5',
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  ...extra,
})

const schema = { type: 'object', additionalProperties: false, required: ['x'], properties: { x: { type: 'string' } } }

Deno.test('askClaude (sonnet): request correto, parse e custo registrado', async () => {
  const { sb, custos } = fakeSb()
  const f = stubFetch(message('{"x":"ok"}'))
  try {
    const out = await askClaude<{ x: string }>(sb, { workspace_id: 'ws', prospect_id: 'p1', origem: 'agent', tier: 'sonnet', effort: 'medium', system: 'sys', user: 'usr', schema })
    assertEquals(out, { x: 'ok' })

    const { url, body, headers } = f.calls[0]
    assert(url.endsWith('/v1/messages'))
    assertEquals(headers.get('x-api-key'), 'sk-test')
    assertEquals(body.model, 'claude-sonnet-5-5')
    assertEquals(body.output_config, { format: { type: 'json_schema', schema }, effort: 'medium' })
    // O Sonnet 5.5 rejeita estes parâmetros com 400:
    for (const banned of ['temperature', 'top_p', 'top_k', 'thinking', 'tool_choice']) assertEquals(banned in body, false, banned)

    // US$2/M entrada, US$10/M saída → 1000*2/1e6 + 200*10/1e6 = 0.004
    assertEquals(custos.length, 1)
    assertEquals(custos[0].modelo, 'claude-sonnet-5-5')
    assertEquals(custos[0].tokens_in, 1000)
    assertEquals(Number(custos[0].custo_usd.toFixed(6)), 0.004)
    assertEquals(custos[0].prospect_id, 'p1')
  } finally {
    f.restore()
  }
})

Deno.test('askClaude (haiku): não envia effort e usa o preço do Haiku', async () => {
  const { sb, custos } = fakeSb()
  const f = stubFetch(message('{"x":"a"}', { model: 'claude-haiku-4-5' }))
  try {
    await askClaude(sb, { workspace_id: 'ws', origem: 'triage', tier: 'haiku', system: 's', user: 'u', schema, effort: 'high' })
    assertEquals(f.calls[0].body.model, 'claude-haiku-4-5')
    assertEquals('effort' in f.calls[0].body.output_config, false)
    // US$1/M entrada, US$5/M saída → 0.001 + 0.001
    assertEquals(Number(custos[0].custo_usd.toFixed(6)), 0.002)
  } finally {
    f.restore()
  }
})

Deno.test('askClaude: erros de contrato viram exceção clara', async () => {
  const { sb } = fakeSb()
  for (const [resp, msg] of [
    [message('{"x":"a"}', { stop_reason: 'max_tokens' }), 'truncada'],
    [message('{"x":"a"}', { stop_reason: 'refusal' }), 'recusou'],
  ] as const) {
    const f = stubFetch(resp)
    try {
      await assertRejects(() => askClaude(sb, { workspace_id: 'ws', origem: 'agent', tier: 'sonnet', system: 's', user: 'u', schema }), Error, msg)
    } finally {
      f.restore()
    }
  }
})
