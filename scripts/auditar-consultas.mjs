// Auditor de consultas sem filtro de workspace.
// As Edge Functions usam a service_role, que ignora o RLS: o isolamento entre clientes depende de cada consulta filtrar por workspace.
// Este auditor lê o código e reprova consulta NOVA de leitura, alteração ou exclusão, em tabela de cliente, que não tenha um filtro
// reconhecido (workspace_id, ou o id de um registro que já foi autorizado: id, prospect_id, campanha_id, fila_id...).
// Inserções e upserts não entram: o destino vem do registro autorizado e não dá para checá-lo lendo o texto.
// Consulta intencionalmente global (cron que varre todos os clientes) entra em scripts/auditar-consultas.excecoes.json, com justificativa.
//
//   node scripts/auditar-consultas.mjs            → confere (usado no CI)
//   node scripts/auditar-consultas.mjs --listar   → mostra todas as consultas sem filtro, para montar as exceções
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Tabelas que pertencem a um cliente (têm workspace_id) e cujas linhas não podem vazar entre clientes.
export const TABELAS = [
  'workspaces', 'workspace_usuarios', 'playbooks', 'campanhas', 'prospects', 'prospect_interacoes', 'prospect_estado', 'fila_acoes',
  'fluxos_automaticos', 'leads_qualificados', 'integracoes', 'custos_uso', 'supressoes', 'source_log', 'prospect_alerts', 'campanha_metricas', 'notificacoes_log',
]

// Filtros que provam que a consulta já está presa a um cliente ou a um registro previamente autorizado.
const FILTROS = [/workspace_id/, /\.(eq|in|match)\(\s*['"](id|prospect_id|campanha_id|fila_id|lead_id|workspace)['"]/, /\{\s*(id|prospect_id|campanha_id)\s*[:,}]/]

function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return arquivos(p)
    return /\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) && e.name !== 'fake_sb.ts' ? [p] : []
  })
}

/** Cada consulta: do `.from('tabela')` até o fim da instrução (próximo `.from(`, linha em branco ou 12 linhas). */
export function consultas(texto) {
  const linhas = texto.split('\n')
  const achados = []
  linhas.forEach((l, i) => {
    for (const m of l.matchAll(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/g)) {
      if (!TABELAS.includes(m[1])) continue
      let fim = i
      for (let j = i + 1; j < Math.min(i + 12, linhas.length); j++) {
        if (linhas[j].trim() === '' || /\.from\(/.test(linhas[j])) break
        fim = j
      }
      achados.push({ tabela: m[1], linha: i + 1, trecho: linhas.slice(i, fim + 1).join(' ').replace(/\s+/g, ' ').trim() })
    }
  })
  return achados
}

const ehEscritaNova = (c) => /\.(insert|upsert)\(/.test(c.trecho) && !/\.(update|delete)\(/.test(c.trecho)
export const temFiltro = (c) => ehEscritaNova(c) || FILTROS.some((r) => r.test(c.trecho))

export function consultasSemFiltro(raiz) {
  const sem = []
  for (const f of arquivos(raiz)) {
    const rel = path.relative(raiz, f).replaceAll('\\', '/')
    for (const c of consultas(fs.readFileSync(f, 'utf8'))) if (!temFiltro(c)) sem.push({ ...c, arquivo: rel })
  }
  return sem
}

/** Compara o que foi achado com as exceções justificadas: consulta nova reprova, exceção que não é mais usada também. */
export function conferir(sem, excecoes) {
  const chave = (x) => `${x.arquivo}|${x.tabela}`
  const permitidas = new Set(excecoes.map(chave))
  const usadas = new Set(sem.map(chave))
  return {
    novas: sem.filter((c) => !permitidas.has(chave(c))),
    obsoletas: excecoes.filter((e) => !usadas.has(chave(e))),
  }
}

function main() {
  const raiz = fileURLToPath(new URL('../supabase/functions/', import.meta.url))
  const excecoes = JSON.parse(fs.readFileSync(new URL('./auditar-consultas.excecoes.json', import.meta.url), 'utf8'))
  const sem = consultasSemFiltro(raiz)

  if (process.argv.includes('--listar')) {
    for (const c of sem) console.log(`${c.arquivo}:${c.linha} [${c.tabela}] ${c.trecho.slice(0, 160)}`)
    console.log(`\n${sem.length} consulta(s) sem filtro reconhecido`)
    return
  }

  const { novas, obsoletas } = conferir(sem, excecoes)
  for (const c of novas) console.error(`SEM FILTRO  ${c.arquivo}:${c.linha} [${c.tabela}] ${c.trecho.slice(0, 160)}`)
  for (const e of obsoletas) console.error(`EXCEÇÃO SEM USO  ${e.arquivo} [${e.tabela}] (apague de auditar-consultas.excecoes.json)`)
  if (novas.length || obsoletas.length) {
    console.error('\nConsulta em tabela de cliente sem filtro de workspace. Filtre por workspace_id ou, se for varredura global intencional, registre a exceção com justificativa em scripts/auditar-consultas.excecoes.json.')
    process.exit(1)
  }
  console.log(`ok: ${sem.length} consulta(s) sem filtro, todas com exceção justificada`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
