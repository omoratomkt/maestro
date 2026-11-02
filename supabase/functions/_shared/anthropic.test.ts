// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { askClaude } from './anthropic.ts'

/** Banco de mentira: só o que askClaude usa (integracoes.maybeSingle e custos_uso.insert). */
function fakeSb(opts: { gastoHoje?: number; limite?: number; avisos?: boolean; pausada?: boolean } = {}) {
  const custos: any[] = []
  const logs: any[] = []
  const sb: any = {
    from(table: string) {
      const q: any = {
        select: () => q,
        eq: () => q,
        gte: () => q,
        upsert: () => q,
        delete: () => q,
        // notificacoes_log: upsert(...).select('id') devolve a reserva do aviso
        then: (ok: (v: unknown) => unknown) => ok({ data: table === 'notificacoes_log' ? [{ id: 'n1' }] : null, error: null }),
        limit: () => Promise.resolve({ data: table === 'custos_uso' ? [{ custo_usd: opts.gastoHoje ?? 0 }] : null, error: null }),
        maybeSingle: () =>
          Promise.resolve({
            data: table === 'plataforma_config' ? { valor: { pausada: opts.pausada === true } } : table === 'integracoes' ? { ativo: true, config: { api_key: 'sk-test', ...(opts.limite ? { limite_diario_usd: opts.limite } : {}), ...(opts.avisos ? { remetente: 'a@b.com', destinatarios: 'op@b.com' } : {}) } } : null,
            error: null,
          }),
        insert: (row: any) => {
          if (table === 'ia_chamadas_log') logs.push(row)
          else custos.push(row)
          return Promise.resolve({ error: null })
        },
      }
      return q
    },
  }
  return { sb, custos, logs }
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

Deno.test('askClaude: respeita o teto diário de IA (padrão US$ 10) sem chamar a API', async () => {
  const f = stubFetch(message('{"x":"a"}'))
  try {
    await assertRejects(() => askClaude(fakeSb({ gastoHoje: 10.5 }).sb, { workspace_id: 'ws', origem: 'agent', tier: 'sonnet', system: 's', user: 'u', schema }), Error, 'Limite diário de IA')
    assertEquals(f.calls.length, 0)
    // com teto configurado maior, passa
    const ok = await askClaude<{ x: string }>(fakeSb({ gastoHoje: 10.5, limite: 20 }).sb, { workspace_id: 'ws', origem: 'agent', tier: 'sonnet', system: 's', user: 'u', schema })
    assertEquals(ok, { x: 'a' })
    assertEquals(f.calls.length, 1)
  } finally {
    f.restore()
  }
})

const resendCalls = (f: { calls: { url: string }[] }) => f.calls.filter((c) => c.url.includes('api.resend.com'))

Deno.test('teto de IA: em 80% avisa por email e a chamada segue', async () => {
  const f = stubFetch(message('{"x":"a"}'))
  try {
    const out = await askClaude<{ x: string }>(fakeSb({ gastoHoje: 8.5, avisos: true }).sb, { workspace_id: 'ws', origem: 'agent', tier: 'sonnet', system: 's', user: 'u', schema })
    assertEquals(out, { x: 'a' })
    const avisos = resendCalls(f)
    assertEquals(avisos.length, 1)
    assertEquals(f.calls.filter((c) => c.url.endsWith('/v1/messages')).length, 1) // a IA ainda respondeu
    assert((avisos[0] as any).body.subject.includes('80%'))
  } finally {
    f.restore()
  }
})

Deno.test('teto de IA: em 100% avisa por email e a IA para sem chamar a API', async () => {
  const f = stubFetch(message('{"x":"a"}'))
  try {
    await assertRejects(() => askClaude(fakeSb({ gastoHoje: 10.5, avisos: true }).sb, { workspace_id: 'ws', origem: 'agent', tier: 'sonnet', system: 's', user: 'u', schema }), Error, 'Limite diário de IA')
    assertEquals(f.calls.filter((c) => c.url.endsWith('/v1/messages')).length, 0)
    const avisos = resendCalls(f)
    assertEquals(avisos.length, 1)
    assert((avisos[0] as any).body.subject.includes('atingido'))
  } finally {
    f.restore()
  }
})

Deno.test('teto de IA: abaixo de 80% não avisa, e sem aviso configurado a IA funciona do mesmo jeito', async () => {
  const f = stubFetch(message('{"x":"a"}'))
  try {
    await askClaude(fakeSb({ gastoHoje: 5, avisos: true }).sb, { workspace_id: 'ws', origem: 'agent', tier: 'sonnet', system: 's', user: 'u', schema })
    assertEquals(resendCalls(f).length, 0)
    await askClaude(fakeSb({ gastoHoje: 9 }).sb, { workspace_id: 'ws', origem: 'agent', tier: 'sonnet', system: 's', user: 'u', schema }) // sem remetente/destinatários
    assertEquals(resendCalls(f).length, 0)
  } finally {
    f.restore()
  }
})

Deno.test('registro por chamada: sucesso guarda papel, modelo, tokens, custo, tempo e texto mascarado', async () => {
  const { sb, logs } = fakeSb()
  const f = stubFetch(message('{"x":"resposta com sk-ant-api03-EXEMPLOEXEMPLO"}'))
  try {
    await askClaude(sb, { workspace_id: 'ws', prospect_id: 'p1', origem: 'triage', tier: 'haiku', system: 's', user: 'mensagem com senha: valorinventado', schema })
    assertEquals(logs.length, 1)
    assertEquals(logs[0].resultado, 'ok')
    assertEquals(logs[0].papel, 'triage')
    assertEquals(logs[0].modelo, 'claude-haiku-4-5')
    assertEquals(logs[0].tokens_in, 1000)
    assert(typeof logs[0].tempo_ms === 'number')
    // nenhum segredo chega ao registro
    assertEquals(String(logs[0].entrada).includes('valorinventado'), false)
    assertEquals(String(logs[0].saida).includes('sk-ant'), false)
  } finally {
    f.restore()
  }
})

Deno.test('interruptor geral: com a IA pausada nada é chamado e a tentativa fica registrada', async () => {
  const { sb, logs } = fakeSb({ pausada: true })
  const f = stubFetch(message('{"x":"a"}'))
  try {
    await assertRejects(() => askClaude(sb, { workspace_id: 'ws', origem: 'agent', tier: 'sonnet', system: 's', user: 'u', schema }), Error, 'pausada pelo administrador')
    assertEquals(f.calls.length, 0)
    assertEquals(logs[0].resultado, 'pausada')
  } finally {
    f.restore()
  }
})

Deno.test('registro por chamada: teto atingido e erro do provedor ficam registrados com o resultado certo', async () => {
  const f = stubFetch({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401)
  try {
    const teto = fakeSb({ gastoHoje: 11 })
    await assertRejects(() => askClaude(teto.sb, { workspace_id: 'ws', origem: 'agent', tier: 'sonnet', system: 's', user: 'u', schema }), Error, 'Limite diário')
    assertEquals(teto.logs[0].resultado, 'bloqueado')

    const erro = fakeSb()
    await assertRejects(() => askClaude(erro.sb, { workspace_id: 'ws', origem: 'agent', tier: 'sonnet', system: 's', user: 'u', schema }))
    assertEquals(erro.logs[0].resultado, 'erro')
    assert(String(erro.logs[0].erro).length > 0)
  } finally {
    f.restore()
  }
})
