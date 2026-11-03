// Telefone canônico, para COMPARAR contatos entre o Maestro e o CRM (mesma regra dos dois lados).
// Nunca use o resultado para ENDEREÇAR uma mensagem: para enviar vale o número como a Evolution o validou
// (alguns números antigos existem sem o 9º dígito). Esta regra também existe em SQL (`telefone_canonico`, migration 025):
// as duas implementações são testadas com a mesma tabela de casos (`telefone.test.ts` e `supabase/sql/teste_telefone.sql`).
//
// Regras: só dígitos; tira `00` ou `0` inicial; 10 ou 11 dígitos = sem DDI (recebe 55); 12 ou 13 começando em 55 = com DDI.
// Depois do DDD, 8 dígitos começando em 6 a 9 é celular e recebe o 9; começando em 2 a 5 é fixo e fica com 8; 9 dígitos precisam
// começar em 9. Número com `+` e DDI diferente de 55 fica como veio (só dígitos). Qualquer outro caso é inválido (`null`).
// O sufixo de JID do WhatsApp (`@s.whatsapp.net`, `:12@...`) é ignorado.

export function telefoneCanonico(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = raw.trim().split('@')[0].split(':')[0]
  const internacional = s.startsWith('+')
  let d = s.replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0')) d = d.slice(1)
  if (internacional && !d.startsWith('55')) return d || null

  let nacional: string
  if (d.length === 10 || d.length === 11) nacional = d
  else if ((d.length === 12 || d.length === 13) && d.startsWith('55')) nacional = d.slice(2)
  else return null

  const ddd = nacional.slice(0, 2)
  let numero = nacional.slice(2)
  if (!/^[1-9][0-9]$/.test(ddd)) return null
  if (numero.length === 8) {
    if (/^[6-9]/.test(numero)) numero = `9${numero}`
    else if (!/^[2-5]/.test(numero)) return null
  } else if (numero.length === 9) {
    if (!numero.startsWith('9')) return null
  } else return null
  return `55${ddd}${numero}`
}
