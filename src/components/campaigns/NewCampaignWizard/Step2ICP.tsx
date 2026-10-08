import { Input } from '@/components/ui/input'
import { Field, TagInput } from './fields'
import type { CampaignDraft } from './types'

interface Props {
  draft: CampaignDraft
  onChange: (d: CampaignDraft) => void
}

export function Step2ICP({ draft, onChange }: Props) {
  const set = <K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]) => onChange({ ...draft, [k]: v })

  return (
    <div className="space-y-4">
      <Field label="Nome da campanha">
        <Input value={draft.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: Clínicas de estética — SP" />
      </Field>
      <Field label="Segmento alvo">
        <Input value={draft.segmento} onChange={(e) => set('segmento', e.target.value)} placeholder="Ex.: Clínicas de estética" />
      </Field>
      <Field label="Cargos alvo" hint="Quem é o decisor. Enter para adicionar.">
        <TagInput value={draft.cargos_alvo} onChange={(v) => set('cargos_alvo', v)} placeholder="Ex.: Sócio, Diretor" />
      </Field>
      <Field label="Regiões" hint="Cidades ou estados.">
        <TagInput value={draft.regioes} onChange={(v) => set('regioes', v)} placeholder="Ex.: São Paulo - SP" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Score mínimo (0–100)" hint="Abaixo disso o prospect não entra no pipeline.">
          <Input type="number" min={0} max={100} value={draft.score_minimo} onChange={(e) => set('score_minimo', Number(e.target.value))} />
        </Field>
        <Field label="Volume semanal" hint="Prospects novos por semana.">
          <Input type="number" min={1} value={draft.volume_semanal} onChange={(e) => set('volume_semanal', Number(e.target.value))} />
        </Field>
      </div>
      <Field label="Critérios de exclusão" hint="Perfis que devem ser descartados.">
        <TagInput value={draft.criterios_exclusao} onChange={(v) => set('criterios_exclusao', v)} placeholder="Ex.: Franquias" />
      </Field>
    </div>
  )
}
