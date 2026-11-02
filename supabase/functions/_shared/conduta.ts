// Regras de conduta verificadas em CÓDIGO sobre o texto que o agente escreveu. O prompt reduz a tentativa; só o código garante.
// A mensagem que as dispara continua na fila de aprovação, mas chega marcada com o aviso para quem aprova (agent.ts).

// Promessa de resultado, urgência falsa e linguagem de propaganda. Lista para revisão do Arthur (decisão de produto).
const PROIBIDAS: { grupo: string; frases: string[] }[] = [
  { grupo: 'promessa de resultado', frases: ['garantido', 'garantimos', 'garantia de resultado', 'sem risco', 'lucro certo', 'dobrar suas vendas', 'dobrar seu faturamento', 'triplicar'] },
  { grupo: 'urgência falsa', frases: ['oportunidade unica', 'ultima chance', 'so hoje', 'ultimas vagas', 'acaba hoje', 'por tempo limitado'] },
  { grupo: 'linguagem de propaganda', frases: ['revolucionario', 'revolucionaria', 'turbinar', 'alavancar', 'sinergia'] },
]

// minúsculas, sem acento e sem pontuação
const normalizar = (t: string) =>
  (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

/** Termos proibidos achados no texto, no formato "grupo: frase" (vazio se não houver). */
export function palavrasProibidas(mensagem: string): string[] {
  const t = ` ${normalizar(mensagem)} `
  return PROIBIDAS.flatMap((g) => g.frases.filter((f) => t.includes(` ${f} `) || t.includes(` ${f}s `)).map((f) => `${g.grupo}: "${f}"`))
}
