// Mascarador de segredos. Roda ANTES de qualquer texto ir para o registro de chamadas de IA (e serve a qualquer log).
// Devolve o texto com cada segredo trocado por [tipo mascarado] e a lista dos tipos achados (nunca o valor).

const PADROES: { tipo: string; re: RegExp }[] = [
  { tipo: 'chave Anthropic', re: /sk-ant-[A-Za-z0-9_-]{10,}/g },
  { tipo: 'chave de IA', re: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { tipo: 'chave Apify', re: /\bapify_api_[A-Za-z0-9]{10,}/g },
  { tipo: 'token Supabase', re: /\bsbp_[a-f0-9]{20,}/g },
  { tipo: 'chave Resend', re: /\bre_[A-Za-z0-9_]{20,}/g },
  { tipo: 'token GitHub', re: /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}/g },
  { tipo: 'chave AWS', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { tipo: 'chave Google', re: /\bAIza[0-9A-Za-z_-]{30,}/g },
  { tipo: 'token Meta', re: /\bEAA[A-Za-z0-9]{30,}/g },
  { tipo: 'JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { tipo: 'chave privada', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g },
  { tipo: 'Bearer', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi },
  // "senha: valor", "password = valor", "token: valor" (o rótulo fica, o valor some)
  { tipo: 'senha', re: /\b(senha|password|passwd|token|secret|segredo|api[_ -]?key)\s*[:=]\s*\S+/gi },
]

export function mascarar(texto: string): { texto: string; achados: string[] } {
  let t = texto ?? ''
  const achados: string[] = []
  for (const { tipo, re } of PADROES) {
    t = t.replace(re, (m, rotulo?: string) => {
      achados.push(tipo)
      return tipo === 'senha' && typeof rotulo === 'string' ? `${rotulo}: [senha mascarada]` : `[${tipo} mascarado]`
    })
  }
  return { texto: t, achados: [...new Set(achados)] }
}

/** Texto pronto para guardar em log: mascarado e cortado em `max` caracteres. */
export const resumirParaLog = (texto: string, max = 1500): string => mascarar(texto).texto.slice(0, max)
