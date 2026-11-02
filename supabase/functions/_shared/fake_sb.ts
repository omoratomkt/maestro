// deno-lint-ignore-file no-explicit-any
// Cliente de banco falso para testes: toda cadeia (.select().eq()...) é registrada e, ao ser aguardada, devolve os dados da tabela.
// Quando a cadeia usa .single() ou .maybeSingle(), devolve só a primeira linha.

export interface Chamada {
  tabela: string
  op: string
  args: any[]
}

export function fakeSb(dados: Record<string, any[]>) {
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
