// deno-lint-ignore-file no-explicit-any
// Lista de supressão ("não contatar"): vale para o workspace inteiro, em todas as campanhas e canais.
import { normalizePhone, type SB } from './util.ts'

export interface Contato {
  email?: string | null
  whatsapp?: string | null
  linkedin_url?: string | null
  instagram_handle?: string | null
  website?: string | null
}

const hostDe = (url: string) => url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0].toLowerCase()
const slugLinkedin = (url: string) => url.trim().replace(/\/+$/, '').split('/').pop()?.toLowerCase() ?? ''
const handleInsta = (h: string) => h.trim().replace(/^@/, '').toLowerCase()
// Compara WhatsApp pelos 8 últimos dígitos (evita falhar por DDI ou pelo 9º dígito).
const cauda = (n: string) => n.slice(-8)

/** Valor normalizado como é guardado em supressoes.valor. */
export function normalizar(tipo: string, valor: string): string {
  switch (tipo) {
    case 'email':
      return valor.trim().toLowerCase()
    case 'dominio':
      return hostDe(valor)
    case 'whatsapp':
      return normalizePhone(valor) ?? valor.replace(/\D/g, '')
    case 'linkedin':
      return valor.includes('/') ? slugLinkedin(valor) : valor.trim().toLowerCase()
    case 'instagram':
      return handleInsta(valor)
    default:
      return valor.trim()
  }
}

const chave = (tipo: string, valorNormalizado: string) => `${tipo}:${tipo === 'whatsapp' ? cauda(valorNormalizado) : valorNormalizado}`

/** Chaves "tipo:valor" que identificam este contato (inclui o domínio do email e do site). */
export function chavesDe(c: Contato): string[] {
  const k: string[] = []
  if (c.email) {
    const e = normalizar('email', c.email)
    k.push(chave('email', e))
    if (e.includes('@')) k.push(chave('dominio', e.split('@')[1]))
  }
  if (c.website) k.push(chave('dominio', hostDe(c.website)))
  if (c.whatsapp) {
    const n = normalizar('whatsapp', c.whatsapp)
    if (n.length >= 8) k.push(chave('whatsapp', n))
  }
  if (c.linkedin_url) k.push(chave('linkedin', normalizar('linkedin', c.linkedin_url)))
  if (c.instagram_handle) k.push(chave('instagram', handleInsta(c.instagram_handle)))
  return k
}

const cache = new Map<string, { set: Set<string>; em: number }>()

export async function carregarSupressoes(sb: SB, workspace_id: string): Promise<Set<string>> {
  const hit = cache.get(workspace_id)
  if (hit && Date.now() - hit.em < 60_000) return hit.set
  const set = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('supressoes').select('tipo, valor').eq('workspace_id', workspace_id).range(from, from + 999)
    if (error) throw new Error(`Falha ao ler a lista de supressão: ${error.message}`)
    for (const r of data ?? []) set.add(chave(r.tipo, r.valor))
    if ((data?.length ?? 0) < 1000) break
  }
  cache.set(workspace_id, { set, em: Date.now() })
  return set
}

export const estaSuprimido = (set: Set<string>, c: Contato): boolean => chavesDe(c).some((k) => set.has(k))

/** Registra o contato (email, WhatsApp, LinkedIn e Instagram que ele tiver) na lista. Nunca suprime o domínio por conta própria. */
export async function suprimir(sb: SB, workspace_id: string, c: Contato, motivo: string, origem: 'manual' | 'resposta' | 'importacao') {
  const rows: any[] = []
  const add = (tipo: string, valor?: string | null) => {
    if (valor && valor.trim()) rows.push({ workspace_id, tipo, valor: normalizar(tipo, valor), motivo, origem })
  }
  add('email', c.email)
  add('whatsapp', c.whatsapp)
  add('linkedin', c.linkedin_url)
  add('instagram', c.instagram_handle)
  if (!rows.length) return
  const { error } = await sb.from('supressoes').upsert(rows, { onConflict: 'workspace_id,tipo,valor', ignoreDuplicates: true })
  if (error) throw new Error(`Falha ao registrar supressão: ${error.message}`)
  cache.delete(workspace_id)
}
