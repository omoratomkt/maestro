// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { montarEmail, notificar, parseDestinatarios, type Aviso } from './notify.ts'

const aviso: Aviso = { tipo: 'lead_qualificado', chave: 'lead-1', assunto: 'Lead qualificado: Acme', titulo: 'Novo lead <b>quente</b>', linhas: ['Dor: <script>x</script>'], link: '/pipeline' }

/** Banco de mentira: integracoes (config do aviso) e notificacoes_log (com a regra de unicidade). */
function fakeSb(config: Record<string, string> | null) {
  const log = new Map<string, string>()
  const sb: any = {
    from(table: string) {
      const q: any = {
        _op: '',
        _row: null as any,
        select() {
          return q
        },
        eq() {
          return q
        },
        maybeSingle: () => Promise.resolve({ data: table === 'integracoes' && config ? { ativo: true, config } : null, error: null }),
        upsert(row: any) {
          q._op = 'upsert'
          q._row = row
          return q
        },
        delete() {
          q._op = 'delete'
          return q
        },
        then(resolve: any) {
          if (q._op === 'upsert') {
            const k = `${q._row.workspace_id}|${q._row.tipo}|${q._row.chave}`
            if (log.has(k)) return resolve({ data: [], error: null })
            log.set(k, 'id-' + log.size)
            return resolve({ data: [{ id: log.get(k) }], error: null })
          }
          if (q._op === 'delete') {
            log.clear()
            return resolve({ error: null })
          }
          resolve({ data: null, error: null })
        },
      }
      return q
    },
  }
  return { sb, log }
}

function stubFetch(status = 200) {
  const calls: any[] = []
  const original = globalThis.fetch
  globalThis.fetch = ((url: any, init: any) => {
    calls.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) })
    return Promise.resolve(new Response(status === 200 ? '{"id":"e1"}' : 'falhou', { status }))
  }) as typeof fetch
  return { calls, restore: () => (globalThis.fetch = original) }
}

const cfg = { api_key: 're_x', remetente: 'Maestro <contato@omorato.com>', destinatarios: 'a@x.com, b@y.com; lixo, c@z.com' }

Deno.test('montarEmail escapa HTML e aponta para o app', () => {
  const { html, text } = montarEmail(aviso, 'https://app.exemplo.com/')
  assertStringIncludes(html, 'Novo lead &lt;b&gt;quente&lt;/b&gt;')
  assert(!html.includes('<script>'))
  assertStringIncludes(html, 'href="https://app.exemplo.com/pipeline"')
  assertStringIncludes(text, 'https://app.exemplo.com/pipeline')
})

Deno.test('parseDestinatarios aceita vírgula, ponto e vírgula e espaço, e descarta lixo', () => {
  assertEquals(parseDestinatarios(cfg.destinatarios), ['a@x.com', 'b@y.com', 'c@z.com'])
  assertEquals(parseDestinatarios(undefined), [])
})

Deno.test('notificar: sem configuração não faz nada', async () => {
  const f = stubFetch()
  try {
    assertEquals(await notificar(fakeSb(null).sb, 'ws', aviso), 'sem_config')
    assertEquals(await notificar(fakeSb({ ...cfg, destinatarios: '' }).sb, 'ws', aviso), 'sem_config')
    assertEquals(f.calls.length, 0)
  } finally {
    f.restore()
  }
})

Deno.test('notificar: chama o Resend uma única vez por fato', async () => {
  const f = stubFetch()
  try {
    const { sb } = fakeSb(cfg)
    assertEquals(await notificar(sb, 'ws', aviso), 'enviado')
    assertEquals(await notificar(sb, 'ws', aviso), 'duplicado')
    assertEquals(f.calls.length, 1)
    const c = f.calls[0]
    assertEquals(c.url, 'https://api.resend.com/emails')
    assertEquals(c.headers.get('authorization'), 'Bearer re_x')
    assertEquals(c.body.from, 'Maestro <contato@omorato.com>')
    assertEquals(c.body.to, ['a@x.com', 'b@y.com', 'c@z.com'])
    assertEquals(c.body.subject, 'Lead qualificado: Acme')
    // outro fato do mesmo tipo é avisado normalmente
    assertEquals(await notificar(sb, 'ws', { ...aviso, chave: 'lead-2' }), 'enviado')
  } finally {
    f.restore()
  }
})

Deno.test('notificar: se o Resend recusar, libera a reserva e devolve o erro (nunca lança)', async () => {
  const f = stubFetch(422)
  try {
    const { sb, log } = fakeSb(cfg)
    const r = await notificar(sb, 'ws', aviso)
    assert(r.startsWith('erro: Resend 422'))
    assertEquals(log.size, 0)
  } finally {
    f.restore()
  }
})
