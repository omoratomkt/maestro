// Gera supabase/migrations/019_playbooks_conteudo.sql a partir de supabase/seeds/playbooks.json (fonte única do conteúdo).
//   node scripts/gerar-migration-playbooks.mjs
// A migration só preenche playbooks cujo ICP ainda está vazio: nunca sobrescreve o que o Arthur editou pela tela.
import fs from 'node:fs'

const playbooks = JSON.parse(fs.readFileSync(new URL('../supabase/seeds/playbooks.json', import.meta.url), 'utf8'))

// Cada playbook inclui a pergunta que todo prospect frio faz (e que a LGPD manda responder com transparência).
const OBJECAO_ORIGEM = {
  objecao: 'Onde vocês conseguiram o meu contato?',
  resposta: 'Seu contato aparece em fontes públicas de empresas do seu segmento (como o Google e redes profissionais). Se preferir não receber mais mensagens, é só me avisar que eu removo agora mesmo.',
}

const q = (tag, texto) => {
  if (texto.includes(`$${tag}$`)) throw new Error('texto contém o delimitador ' + tag)
  return `$${tag}$${texto}$${tag}$`
}

let sql = `-- 019 — conteúdo inicial dos 6 playbooks (ICP, persona e critérios de qualificação).
-- GERADO por scripts/gerar-migration-playbooks.mjs a partir de supabase/seeds/playbooks.json. Edite o JSON, não este arquivo.
-- Só preenche playbooks cujo icp_padrao ainda está vazio: nunca sobrescreve edições feitas pela tela.
-- Os campos entre colchetes (nome, produto, segmento) são preenchidos ao criar cada campanha.
`

for (const p of playbooks) {
  const objecoes = [...p.persona.objecoes, OBJECAO_ORIGEM]
  sql += `
UPDATE playbooks SET
  descricao = ${q('d', p.descricao)},
  icp_padrao = ${q('j', JSON.stringify(p.icp))}::jsonb,
  persona_padrao = ${q('j', JSON.stringify({ ...p.persona, objecoes }))}::jsonb,
  criterios_qualificacao_padrao = ${q('j', JSON.stringify(p.criterios))}::jsonb
WHERE nome = ${q('n', p.nome)} AND icp_padrao = '{}'::jsonb;
`
}

fs.writeFileSync(new URL('../supabase/migrations/019_playbooks_conteudo.sql', import.meta.url), sql)
console.log(`${playbooks.length} playbooks → supabase/migrations/019_playbooks_conteudo.sql`)
