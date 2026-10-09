// Verifica se as consultas (com junções embutidas) que o frontend faz ainda são aceitas pela API do Supabase.
// Existe porque uma migration de chaves estrangeiras já tornou uma junção ambígua (HTTP 300) sem que os testes percebessem.
// Usa só a chave anon (pública); com ela as tabelas voltam vazias, mas o PostgREST valida a consulta do mesmo jeito.
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_ANON_KEY')
  process.exit(2)
}

// Mantenha em sincronia com os hooks em src/hooks (cada linha = uma consulta real do app).
const consultas = [
  'fila_acoes?select=*,prospects!fila_acoes_prospect_id_fkey(nome_empresa,nome_contato,cargo,score),campanhas!fila_acoes_campanha_id_fkey(nome)&limit=1',
  'fila_acoes?select=*,prospects!fila_acoes_prospect_id_fkey(nome_empresa)&limit=1',
  'leads_qualificados?select=*,prospects!leads_qualificados_prospect_id_fkey(nome_empresa,nome_contato,cargo)&limit=1',
  'prospect_interacoes?select=*,prospects!inner(nome_empresa,nome_contato,cargo,workspace_id)&limit=1',
  'prospect_interacoes?select=id,prospects!inner(workspace_id)&limit=1',
  'prospects?select=*&order=score.desc.nullslast&limit=1',
  'campanhas?select=*&limit=1',
  'fluxos_automaticos?select=*&limit=1',
  'supressoes?select=*&limit=1',
  'ciclo_log?select=*&limit=1',
  'source_log?select=*&limit=1',
]

let ruins = 0
for (const q of consultas) {
  const r = await fetch(`${url}/rest/v1/${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  const ok = r.status === 200
  if (!ok) ruins++
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${r.status} ${q.slice(0, 110)}`)
  if (!ok) console.log('      ' + (await r.text()).slice(0, 300))
}
const rpc = await fetch(`${url}/rest/v1/rpc/metricas_resumo`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ dias: 30, p_ws: null }) })
console.log(`${rpc.status === 200 ? 'OK  ' : 'FALHA'} ${rpc.status} rpc/metricas_resumo`)
if (rpc.status !== 200) ruins++
console.log(ruins ? `\n${ruins} consulta(s) com problema` : '\nTodas as consultas do app são aceitas pela API')
process.exitCode = ruins ? 1 : 0
