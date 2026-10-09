// Espelho de supabase/functions/_shared/suppression.ts (as duas pontas precisam normalizar igual).

export const TIPOS_SUPRESSAO = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'dominio', label: 'Domínio (empresa inteira)' },
] as const

const hostDe = (url: string) => url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0].toLowerCase()

export function normalizarSupressao(tipo: string, valor: string): string {
  const v = valor.trim()
  switch (tipo) {
    case 'email':
      return v.toLowerCase()
    case 'dominio':
      return hostDe(v)
    case 'whatsapp': {
      const d = v.replace(/\D/g, '')
      return d.length === 10 || d.length === 11 ? `55${d}` : d
    }
    case 'linkedin':
      return v.includes('/') ? (v.replace(/\/+$/, '').split('/').pop() ?? '').toLowerCase() : v.toLowerCase()
    case 'instagram':
      return v.replace(/^@/, '').toLowerCase()
    default:
      return v
  }
}

const chave = (tipo: string, valor: string) => `${tipo}:${tipo === 'whatsapp' ? valor.slice(-8) : valor}`

export function chavesDoContato(c: { email?: string | null; whatsapp?: string | null; linkedin_url?: string | null; instagram_handle?: string | null; website?: string | null }): string[] {
  const k: string[] = []
  if (c.email) {
    const e = normalizarSupressao('email', c.email)
    k.push(chave('email', e))
    if (e.includes('@')) k.push(chave('dominio', e.split('@')[1]))
  }
  if (c.website) k.push(chave('dominio', hostDe(c.website)))
  if (c.whatsapp) {
    const n = normalizarSupressao('whatsapp', c.whatsapp)
    if (n.length >= 8) k.push(chave('whatsapp', n))
  }
  if (c.linkedin_url) k.push(chave('linkedin', normalizarSupressao('linkedin', c.linkedin_url)))
  if (c.instagram_handle) k.push(chave('instagram', normalizarSupressao('instagram', c.instagram_handle)))
  return k
}

export const chaveDaLinha = (tipo: string, valor: string) => chave(tipo, valor)
