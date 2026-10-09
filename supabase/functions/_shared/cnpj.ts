// CNPJ: validação dos dígitos verificadores e busca em texto/HTML (rodapé de sites costuma trazer o CNPJ).

export function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const dv = (base: string): number => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = [...base].reduce((acc, ch, i) => acc + Number(ch) * pesos[i], 0)
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = dv(d.slice(0, 12))
  return d1 === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13])
}

/** Primeiro CNPJ com dígitos verificadores corretos encontrado no texto (formatado ou só números rotulados). */
export function extrairCnpj(html: string): string | null {
  const texto = html.replace(/<[^>]+>/g, ' ')
  for (const m of texto.matchAll(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g)) {
    const d = m[0].replace(/\D/g, '')
    // Só aceita sem formatação quando vem logo depois da palavra CNPJ, para não confundir com telefone ou ID.
    const formatado = /[./-]/.test(m[0])
    const rotulado = /cnpj[^0-9]{0,12}$/i.test(texto.slice(Math.max(0, (m.index ?? 0) - 20), m.index ?? 0))
    if ((formatado || rotulado) && cnpjValido(d)) return d
  }
  return null
}
