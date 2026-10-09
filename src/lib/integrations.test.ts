import { describe, expect, it } from 'vitest'
import { canalLabel } from './constants'
import { INTEGRATIONS, maskSecret, randomSecret } from './integrations'

describe('catálogo de integrações', () => {
  it('tipos são únicos', () => {
    const tipos = INTEGRATIONS.map((i) => i.tipo)
    expect(new Set(tipos).size).toBe(tipos.length)
  })

  it('toda integração com webhook tem o campo webhook_secret (as Edge Functions autenticam por ele)', () => {
    for (const i of INTEGRATIONS.filter((x) => x.webhook)) {
      expect(i.fields.map((f) => f.key), i.tipo).toContain('webhook_secret')
    }
  })

  it('as integrações que as Edge Functions consultam existem com os campos esperados', () => {
    const campos = (tipo: string) => INTEGRATIONS.find((i) => i.tipo === tipo)?.fields.map((f) => f.key) ?? []
    expect(campos('anthropic')).toContain('api_key')
    expect(campos('whatsapp_evolution')).toEqual(expect.arrayContaining(['base_url', 'api_key', 'instance']))
    expect(campos('whatsapp_meta')).toEqual(expect.arrayContaining(['access_token', 'phone_number_id']))
    expect(campos('email_instantly')).toEqual(expect.arrayContaining(['api_key', 'campaign_id']))
    expect(campos('instagram_meta')).toEqual(expect.arrayContaining(['access_token', 'instagram_account_id']))
    expect(campos('google_places')).toContain('api_key')
    expect(campos('apify')).toContain('api_token')
    expect(campos('calcom')).toContain('booking_url')
    expect(campos('inbound_webhook')).toContain('webhook_secret')
  })

  it('maskSecret nunca mostra o valor inteiro', () => {
    expect(maskSecret('sk-ant-segredo-1234')).toBe('••••1234')
    expect(maskSecret(undefined)).toBe('')
  })

  it('randomSecret gera segredos longos e diferentes', () => {
    const a = randomSecret()
    expect(a).toMatch(/^[0-9a-f]{48}$/)
    expect(randomSecret()).not.toBe(a)
  })
})

describe('rótulos de canal', () => {
  it('aceita o vocabulário de campanhas e o de interações', () => {
    expect(canalLabel('whatsapp_evolution')).toMatch(/Evolution/)
    expect(canalLabel('whatsapp')).toBe('WhatsApp')
    expect(canalLabel('email')).toBe('Email')
    expect(canalLabel('desconhecido')).toBe('desconhecido')
  })
})
