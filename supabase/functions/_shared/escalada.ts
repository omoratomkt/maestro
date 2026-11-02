// Situações em que o agente não deve conversar: reconhecidas por código, ANTES de qualquer chamada ao modelo.
// Aqui a IA para, o contato fica marcado como "aguardando humano" e o operador é avisado (inbound.ts).
// Errar para o lado de escalar é o lado seguro: a pessoa lê a mensagem e decide.

const GATILHOS: { motivo: string; frases: string[] }[] = [
  { motivo: 'assunto jurídico', frases: ['advogado', 'procon', 'juridico', 'notificacao extrajudicial', 'processo judicial'] },
  { motivo: 'reclamação ou denúncia', frases: ['golpe', 'spam', 'reclamacao', 'reclamar', 'ouvidoria', 'policia', 'denuncia'] },
  {
    motivo: 'pediu para falar com uma pessoa',
    frases: ['falar com um humano', 'falar com uma pessoa', 'falar com alguem de verdade', 'falar com o responsavel', 'falar com o dono', 'atendente humano', 'quero um humano'],
  },
]

// minúsculas, sem acento e sem pontuação
const normalizar = (t: string) =>
  (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

/** Motivo da escalada se a mensagem pede uma pessoa ou toca em assunto que a IA não trata; senão null. */
export function motivoDeEscalada(texto: string): string | null {
  const t = normalizar(texto)
  if (!t) return null
  return GATILHOS.find((g) => g.frases.some((f) => t.includes(f)))?.motivo ?? null
}

/** Áudio, imagem e documento: a IA não os entende, e um pedido de parar falado passaria despercebido. */
export const ehMensagemNaoTextual = (tipo?: string) => tipo === 'audio' || tipo === 'image' || tipo === 'document'
