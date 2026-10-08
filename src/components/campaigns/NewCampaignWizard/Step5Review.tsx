import { CANAIS, FONTES, TONS, labelOf } from '@/lib/constants'
import type { CampaignDraft } from './types'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 border-b py-2 text-xs last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  )
}

export function Step5Review({ draft: d }: { draft: CampaignDraft }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Revise antes de lançar. Você pode salvar como rascunho e lançar depois. Toda ação do agente passará pela fila de supervisão.
      </p>
      <dl>
        <Row label="Nome">{d.nome}</Row>
        <Row label="Segmento">{d.segmento}</Row>
        <Row label="Cargos alvo">{d.cargos_alvo.join(', ')}</Row>
        <Row label="Regiões">{d.regioes.join(', ')}</Row>
        <Row label="Score mínimo">{d.score_minimo}</Row>
        <Row label="Volume semanal">{d.volume_semanal}</Row>
        <Row label="Exclusões">{d.criterios_exclusao.join(', ')}</Row>
        <Row label="Canais">{d.canais.map((v) => labelOf(CANAIS, v)).join(', ')}</Row>
        <Row label="Fontes">{d.fontes.map((v) => labelOf(FONTES, v)).join(', ')}</Row>
        <Row label="Persona">{`${d.persona_nome} — ${labelOf(TONS, d.persona_tom)}`}</Row>
        <Row label="Produto">{d.persona_produto}</Row>
        <Row label="Argumentos">{d.persona_argumentos.join(' · ')}</Row>
        <Row label="Objeções">{d.persona_objecoes.length ? `${d.persona_objecoes.length} cadastrada(s)` : ''}</Row>
        <Row label="Qualificação">
          {d.criterios_qualificacao.length ? d.criterios_qualificacao.map((c) => c.campo).join(', ') : ''}
        </Row>
      </dl>
    </div>
  )
}
