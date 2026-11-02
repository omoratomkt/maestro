/** Rótulos e formatos da aba Agentes. */
export const RESULTADO_ROTULO: Record<string, string> = { ok: 'ok', erro: 'erro', bloqueado: 'teto atingido', pausada: 'IA pausada' }

export const usd = (v: number) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
