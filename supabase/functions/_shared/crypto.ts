// Criptografia em repouso das credenciais (integracoes.config).
// AES-256-GCM; a chave fica no secret CREDENTIALS_KEY das Edge Functions (base64 de 32 bytes), nunca no banco.
// Formato do valor guardado: enc:v1:<iv base64>:<texto cifrado base64>. Valores sem esse prefixo são lidos como texto puro
// (compatibilidade enquanto houver dados antigos).

const PREFIXO = 'enc:v1:'
const SENSIVEL = /(key|token|secret|password|senha)/i

export const campoSensivel = (chave: string): boolean => SENSIVEL.test(chave)
export const estaCifrado = (v: unknown): v is string => typeof v === 'string' && v.startsWith(PREFIXO)

const b64 = (b: Uint8Array): string => btoa(String.fromCharCode(...b))
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

let cache: { raw: string; key: Promise<CryptoKey> } | null = null

function chave(): Promise<CryptoKey> {
  const raw = Deno.env.get('CREDENTIALS_KEY')
  if (!raw) throw new Error('CREDENTIALS_KEY não configurada nas Edge Functions')
  if (cache?.raw !== raw) {
    const bytes = unb64(raw)
    if (bytes.length !== 32) throw new Error('CREDENTIALS_KEY deve ter 32 bytes (base64)')
    cache = { raw, key: crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']) }
  }
  return cache.key
}

export async function cifrar(texto: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chave(), new TextEncoder().encode(texto)))
  return `${PREFIXO}${b64(iv)}:${b64(ct)}`
}

export async function decifrar(valor: string): Promise<string> {
  if (!estaCifrado(valor)) return valor
  const [iv, ct] = valor.slice(PREFIXO.length).split(':')
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await chave(), unb64(ct))
  return new TextDecoder().decode(claro)
}

/** Cifra os campos sensíveis ainda em texto puro; o resto da configuração passa intacto. */
export async function cifrarConfig<T extends Record<string, unknown>>(config: T): Promise<T> {
  const out: Record<string, unknown> = { ...config }
  for (const [k, v] of Object.entries(out)) {
    if (campoSensivel(k) && typeof v === 'string' && v && !estaCifrado(v)) out[k] = await cifrar(v)
  }
  return out as T
}

/** Devolve a configuração com todos os campos cifrados abertos. */
export async function decifrarConfig<T extends Record<string, unknown>>(config: T | null | undefined): Promise<T> {
  const out: Record<string, unknown> = { ...(config ?? {}) }
  for (const [k, v] of Object.entries(out)) {
    if (estaCifrado(v)) out[k] = await decifrar(v)
  }
  return out as T
}
