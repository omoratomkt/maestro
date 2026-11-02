// agentes-info — devolve ao painel os papéis de IA do Maestro e o texto REAL de cada prompt (o mesmo que as funções usam).
// POST {}  ·  Auth: JWT de qualquer usuário logado (o painel só mostra; ninguém edita o prompt aqui).
import { personaPrompt } from '../_shared/agent.ts'
import { MODELS } from '../_shared/anthropic.ts'
import { PAPEIS, PROMPTS_FIXOS } from '../_shared/papeis.ts'
import { corsHeaders, json } from '../_shared/util.ts'

// Campanha de exemplo só para o painel exibir o molde do prompt do agente (a persona real vem de cada campanha).
const CAMPANHA_EXEMPLO = {
  persona_nome: '<nome da persona da campanha>',
  persona_produto: '<produto ou serviço da campanha>',
  persona_tom: '<tom de voz da campanha>',
  persona_argumentos: ['<argumentos da campanha>'],
  persona_objecoes: [{ objecao: '<objeção>', resposta: '<resposta>' }],
  criterios_qualificacao: [{ campo: '<critério>', pergunta: '<pergunta>', obrigatorio: true }],
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const papeis = PAPEIS.map((p) => ({
    papel: p.papel,
    nome: p.nome,
    modelo: MODELS[p.modelo],
    funcao: p.funcao,
    editavel: p.editavel,
    prompt: p.papel === 'agent' ? personaPrompt(CAMPANHA_EXEMPLO, ['whatsapp', 'email'], '<link de agendamento, se houver>') : (PROMPTS_FIXOS[p.papel] ?? ''),
  }))
  return json({ papeis })
})
