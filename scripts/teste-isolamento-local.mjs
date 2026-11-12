// Lê a saída do psql do teste de isolamento (supabase/sql/teste_isolamento_rls.sql) rodado num banco local e falha se algo não passou.
// Uso (CI):  psql <url> -v ON_ERROR_STOP=1 -X -A -t -f supabase/sql/teste_isolamento_rls.sql > saida.txt && node scripts/teste-isolamento-local.mjs saida.txt
import fs from 'node:fs'

const arquivo = process.argv[2]
if (!arquivo) {
  console.error('Informe o arquivo com a saída do psql.')
  process.exit(2)
}
const linha = fs.readFileSync(arquivo, 'utf8').split('\n').find((l) => l.trim().startsWith('['))
if (!linha) {
  console.error('Não achei o resultado do teste na saída do psql.')
  process.exit(2)
}
const rows = JSON.parse(linha)
let ruins = 0
for (const r of rows) {
  if (!r.ok) ruins++
  console.log(`${r.ok ? 'OK   ' : 'FALHA'} [${r.quem}] ${r.teste} (esperado: ${r.esperado}; obtido: ${r.obtido})`)
}
console.log(`\n${rows.length - ruins}/${rows.length} verificações de isolamento passaram`)
process.exit(ruins || rows.length === 0 ? 1 : 0)
