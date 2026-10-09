import { supabase } from '@/lib/supabase'

const POR_PAGINA = 1000

// Tabelas com coluna workspace_id. As credenciais (integracoes) NUNCA são exportadas: só quais integrações existem.
const COM_WORKSPACE = [
  'campanhas',
  'prospects',
  'fila_acoes',
  'leads_qualificados',
  'fluxos_automaticos',
  'supressoes',
  'custos_uso',
  'campanha_metricas',
  'prospect_alerts',
  'source_log',
] as const

// Tabelas filhas de prospects (sem workspace_id): filtradas pela junção.
const DE_PROSPECTS = ['prospect_interacoes', 'prospect_estado'] as const

type Linha = Record<string, unknown>

async function paginar(montar: (de: number, ate: number) => PromiseLike<{ data: Linha[] | null; error: { message: string } | null }>): Promise<Linha[]> {
  const todas: Linha[] = []
  for (let de = 0; ; de += POR_PAGINA) {
    const { data, error } = await montar(de, de + POR_PAGINA - 1)
    if (error) throw new Error(error.message)
    todas.push(...(data ?? []))
    if ((data?.length ?? 0) < POR_PAGINA) return todas
  }
}

/** Reúne todos os dados do workspace num objeto (para o cliente levar ao encerrar o contrato, ou para auditoria). */
export async function coletarDadosDoWorkspace(workspaceId: string): Promise<Record<string, unknown>> {
  const ws = await supabase.from('workspaces').select('*').eq('id', workspaceId).single()
  if (ws.error) throw new Error(ws.error.message)

  const resultado: Record<string, unknown> = { exportado_em: new Date().toISOString(), workspace: ws.data }

  for (const tabela of COM_WORKSPACE) {
    resultado[tabela] = await paginar((de, ate) => supabase.from(tabela).select('*').eq('workspace_id', workspaceId).order('id').range(de, ate))
  }
  for (const tabela of DE_PROSPECTS) {
    const linhas = await paginar((de, ate) =>
      supabase.from(tabela).select('*, prospects!inner(workspace_id)').eq('prospects.workspace_id', workspaceId).order('id').range(de, ate),
    )
    resultado[tabela] = linhas.map(({ prospects: _ignorado, ...resto }) => resto)
  }

  const usuarios = await supabase.from('workspace_usuarios').select('user_id, role, criado_em').eq('workspace_id', workspaceId)
  resultado.usuarios = usuarios.data ?? []
  const integ = await supabase.from('integracoes').select('tipo, ativo, criado_em').eq('workspace_id', workspaceId)
  resultado.integracoes_configuradas = integ.data ?? []
  return resultado
}

export async function baixarDadosDoWorkspace(workspaceId: string, slug: string): Promise<void> {
  const dados = await coletarDadosDoWorkspace(workspaceId)
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `maestro-${slug}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Exclui o workspace e, em cascata, tudo que é dele. Irreversível. */
export async function excluirWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId)
  if (error) throw new Error(error.message)
}
