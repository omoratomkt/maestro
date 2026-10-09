// deno-lint-ignore-file no-explicit-any
// webhook-calcom — reflete agendamentos do Cal.com no lead e no pipeline.
//
// URL a cadastrar no Cal.com (Settings → Developer → Webhooks), eventos BOOKING_CREATED, BOOKING_RESCHEDULED e BOOKING_CANCELLED:
//   https://<projeto>.supabase.co/functions/v1/webhook-calcom?ws=<workspace_id>
// Segredo: o mesmo `webhook_secret` da integração calcom, informado no campo "Secret" do webhook (assinatura HMAC SHA-256 em x-cal-signature-256).
// O prospect é identificado pelo email do participante.
import { generateBriefing } from '../_shared/briefing.ts'
import { notificar } from '../_shared/notify.ts'
import { corsHeaders, errMessage, json, serviceClient, timingSafeEqual, type SB } from '../_shared/util.ts'
import { decifrarConfig } from '../_shared/crypto.ts'
import { upsertEstado } from '../_shared/agent.ts'

async function hmac(secret: string, payload: string): Promise<{ hex: string; b64: string }> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
  return { hex: [...sig].map((b) => b.toString(16).padStart(2, '0')).join(''), b64: btoa(String.fromCharCode(...sig)) }
}

const quando = (iso: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso)) + ' (Brasília)'

async function aplicar(sb: SB, ws: string, evento: string, p: any) {
  const emails: string[] = (p.attendees ?? []).map((a: any) => String(a.email ?? '').toLowerCase()).filter(Boolean)
  let prospect: any = null
  for (const e of emails) {
    const { data } = await sb.from('prospects').select('*').eq('workspace_id', ws).ilike('email', e).order('ultima_interacao_em', { ascending: false, nullsFirst: false }).limit(1)
    if (data?.[0]) {
      prospect = data[0]
      break
    }
  }
  if (!prospect) return { ignorado: 'nenhum prospect com o email do participante' }
  const agora = new Date().toISOString()

  // Garante a linha do lead (agendou direto, sem passar pela qualificação em conversa).
  let { data: lead } = await sb.from('leads_qualificados').select('id').eq('prospect_id', prospect.id).maybeSingle()
  if (!lead && evento !== 'BOOKING_CANCELLED') {
    try {
      await generateBriefing(sb, prospect.id)
    } catch {
      await sb.from('leads_qualificados').insert({ workspace_id: ws, prospect_id: prospect.id, briefing: { origem: 'Agendamento direto no Cal.com' }, proximo_passo: 'Reunião agendada' })
    }
    lead = (await sb.from('leads_qualificados').select('id').eq('prospect_id', prospect.id).maybeSingle()).data
  }
  if (!lead) return { ignorado: 'cancelamento sem lead' }

  if (evento === 'BOOKING_CANCELLED') {
    await sb.from('leads_qualificados').update({ status_reuniao: 'cancelada', atualizado_em: agora }).eq('id', lead.id)
    if (prospect.status === 'agendado') await sb.from('prospects').update({ status: 'qualificado', atualizado_em: agora }).eq('id', prospect.id)
    // O agente retoma e propõe novo horário.
    await upsertEstado(sb, prospect.id, { aguardando: 'nenhum', proxima_acao_em: agora })
    if (prospect.fonte !== 'demo') {
      await notificar(sb, ws, { tipo: 'reuniao_cancelada', chave: `${prospect.id}:${p.uid}`, assunto: `Reunião cancelada: ${prospect.nome_empresa}`, titulo: `${prospect.nome_empresa} cancelou a reunião`, linhas: [`Era para ${quando(p.startTime)}.`, 'O agente vai propor um novo horário.'], link: '/pipeline' })
    }
    return { prospect_id: prospect.id, status_reuniao: 'cancelada' }
  }

  await sb
    .from('leads_qualificados')
    .update({ status_reuniao: 'agendada', reuniao_em: p.startTime, calcom_booking_id: p.uid, proximo_passo: 'Reunião agendada', atualizado_em: agora })
    .eq('id', lead.id)
  await sb.from('prospects').update({ status: 'agendado', atualizado_em: agora }).eq('id', prospect.id)
  // Reunião marcada: propostas abertas ficam obsoletas e o agente espera.
  await sb.from('fila_acoes').update({ status: 'cancelada' }).eq('prospect_id', prospect.id).eq('status', 'pendente')
  await upsertEstado(sb, prospect.id, { aguardando: 'nenhum', proxima_acao_em: null })
  if (prospect.fonte !== 'demo') {
    await notificar(sb, ws, { tipo: 'reuniao_agendada', chave: `${prospect.id}:${p.uid}`, assunto: `Reunião marcada: ${prospect.nome_empresa}`, titulo: evento === 'BOOKING_RESCHEDULED' ? `${prospect.nome_empresa} remarcou a reunião` : `${prospect.nome_empresa} marcou uma reunião`, linhas: [`Quando: ${quando(p.startTime)}`, `Com: ${prospect.nome_contato ?? prospect.nome_empresa}`], link: '/pipeline' })
  }
  return { prospect_id: prospect.id, status_reuniao: 'agendada', reuniao_em: p.startTime }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  const ws = new URL(req.url).searchParams.get('ws')
  if (!ws) return json({ error: 'forbidden' }, 403)
  const sb = serviceClient()
  const { data: integ } = await sb.from('integracoes').select('config, ativo').eq('workspace_id', ws).eq('tipo', 'calcom').maybeSingle()
  const secret = integ?.config ? (await decifrarConfig(integ.config as Record<string, string>)).webhook_secret : undefined
  if (!integ?.ativo || !secret) return json({ error: 'forbidden' }, 403)

  const raw = await req.text()
  const sent = (req.headers.get('x-cal-signature-256') ?? '').replace(/^sha256=/, '')
  const sig = await hmac(secret, raw)
  // A documentação do Cal.com não diz a codificação da assinatura; hex é o usual, base64 fica de reserva.
  if (!timingSafeEqual(sent.toLowerCase(), sig.hex) && !timingSafeEqual(sent, sig.b64)) return json({ error: 'assinatura inválida' }, 403)

  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  const evento = String(body.triggerEvent ?? '')
  if (!['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED'].includes(evento)) return json({ ok: true, ignorado: evento })

  try {
    return json({ ok: true, ...(await aplicar(sb, ws, evento, body.payload ?? {})) })
  } catch (e) {
    console.error('webhook-calcom', errMessage(e))
    return json({ error: errMessage(e) }, 500)
  }
})
