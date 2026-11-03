// deno-lint-ignore-file no-explicit-any
// Cliente de banco falso para testes: toda cadeia (.select().eq()...) é registrada e, ao ser aguardada, devolve os dados da tabela.
// Quando a cadeia usa .single() ou .maybeSingle(), devolve só a primeira linha.

export interface Chamada {
  tabela: string
  op: string
  args: any[]
}

/** `erros`: "tabela:operação" → mensagem; a cadeia que usar essa operação devolve esse erro (ex.: { 'prospect_interacoes:insert': 'falhou' }). */
export function fakeSb(dados: Record<string, any[]>, opcoes: { erros?: Record<string, string> } = {}) {
  const chamadas: Chamada[] = []
  const sb = {
    from(tabela: string) {
      const cadeia: any = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === 'then') {
              const lista = dados[tabela] ?? []
              const unico = chamadas.some((c) => c.tabela === tabela && (c.op === 'single' || c.op === 'maybeSingle'))
              const falha = Object.entries(opcoes.erros ?? {}).find(([k]) => chamadas.some((c) => `${c.tabela}:${c.op}` === k && c.tabela === tabela))
              if (falha) return (ok: (v: unknown) => unknown) => ok({ data: null, error: { message: falha[1] }, count: 0 })
              return (ok: (v: unknown) => unknown) => ok({ data: unico ? (lista[0] ?? null) : lista, error: null, count: lista.length })
            }
            return (...args: any[]) => {
              chamadas.push({ tabela, op: prop, args })
              return cadeia
            }
          },
        },
      )
      return cadeia
    },
  }
  return { sb: sb as any, chamadas }
}
