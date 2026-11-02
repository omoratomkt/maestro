// Pedido de descadastro reconhecido por código, ANTES de qualquer chamada ao modelo (LGPD).
// A triagem por IA (inbound.ts) continua como segunda barreira, mas não pode ser a única: se a chamada falhar,
// o teto de gasto estourar ou o modelo classificar errado, o pedido de sair teria passado.
//
// Duas listas:
//  - palavras e frases curtas ("parar", "pare", "sair"): valem como a mensagem inteira, o começo ou o fim dela, e só em mensagem curta;
//  - frases de saída ("quero sair da lista", "me remove"): valem em QUALQUER parte da mensagem, por serem específicas.
// Errar para o lado de descadastrar é o lado seguro: quem não queria sair pode voltar a falar; quem queria e não foi ouvido é problema.

export const OPTOUT_FRASES_CURTAS = ['parar', 'pare', 'stop', 'sair', 'descadastrar', 'cancelar contato', 'nao quero mais', 'remover']

export const OPTOUT_FRASES_EM_QUALQUER_PARTE = [
  'sair da lista', 'sair dessa lista', 'sair desta lista',
  'me remove', 'me remova', 'me removam', 'remover da lista', 'remover meu numero', 'remover meu contato',
  'me tira da lista', 'me tirem da lista', 'me tire da lista', 'tirar da lista', 'tire da lista', 'tirar meu numero', 'tira meu numero', 'tire meu numero',
  'me exclui da lista', 'me exclua', 'me excluam',
  'nunca mais me envie', 'nunca mais me mande', 'nunca mais me chame',
  'nao quero receber', 'nao quero mais receber', 'nao me envie', 'nao me mande',
  'para de me mandar', 'pare de me mandar', 'parem de me mandar', 'parar de me mandar',
  'para de me enviar', 'pare de me enviar', 'parem de me enviar', 'parar de me enviar',
  'para de me chamar', 'pare de me chamar', 'nao me chame', 'nao me procure',
  'descadastra', 'descadastrar meu', 'cancelar meu cadastro',
  'vou denunciar', 'vou processar',
]

/** Acima deste número de palavras, as palavras curtas ("sair", "pare") deixam de valer sozinhas no começo ou no fim. */
const MAX_PALAVRAS_FRASE_CURTA = 8

// minúsculas e sem acento: "não quero mais" e "nao quero mais" valem igual
function normalizar(texto: string): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

export function ehOptOut(texto: string): boolean {
  const t = normalizar(texto)
  if (!t) return false
  if (OPTOUT_FRASES_EM_QUALQUER_PARTE.some((f) => t.includes(f))) return true
  if (t.split(' ').length > MAX_PALAVRAS_FRASE_CURTA) return false
  return OPTOUT_FRASES_CURTAS.some((f) => t === f || t.startsWith(`${f} `) || t.endsWith(` ${f}`))
}
