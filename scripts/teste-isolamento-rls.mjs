// Teste de isolamento entre workspaces (RLS) contra o projeto real, sem deixar nada no banco:
// o SQL roda numa transação que termina em ROLLBACK. Rode antes de cada release e depois de qualquer migration.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/teste-isolamento-rls.mjs
//
// (O token de acesso é só para esta execução; não o grave em arquivo.)
import fs from 'node:fs'

const token = process.env.SUPABASE_ACCESS_TOKEN
const ref = process.env.SUPABASE_PROJECT_REF ?? 'qexigmtnezgbmmkqneei'
if (!token) {
  console.error('Defina SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens).')
  process.exit(2)
}
const query = fs.readFileSync(new URL('../supabase/sql/teste_isolamento_rls.sql', import.meta.url), 'utf8')
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
})
const body = await res.json()
if (!res.ok) {
  console.error('Erro ao executar o teste:', JSON.stringify(body).slice(0, 600))
  process.exit(2)
}
const rows = body.at(-1)?.resultados ?? body[0]?.resultados
if (!rows) {
  console.error('Resposta inesperada:', JSON.stringify(body).slice(0, 600))
  process.exit(2)
}
let ruins = 0
for (const r of rows) {
  if (!r.ok) ruins++
  console.log(`${r.ok ? 'OK   ' : 'FALHA'} [${r.quem}] ${r.teste} (esperado: ${r.esperado}; obtido: ${r.obtido})`)
}
console.log(`\n${rows.length - ruins}/${rows.length} verificações de isolamento passaram`)
process.exitCode = ruins ? 1 : 0
