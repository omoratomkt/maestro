import { CANAIS, FONTES } from '@/lib/constants'
import { ChipSelect, Field } from './fields'
import type { CampaignDraft } from './types'

interface Props {
  draft: CampaignDraft
  onChange: (d: CampaignDraft) => void
}

export function Step3Channels({ draft, onChange }: Props) {
  return (
    <div className="space-y-5">
      <Field label="Canais ativos" hint="O agente decide qual usar em cada prospect, entre os canais selecionados.">
        <ChipSelect options={CANAIS} value={draft.canais} onChange={(v) => onChange({ ...draft, canais: v })} />
      </Field>
      <Field label="Fontes de prospects">
        <ChipSelect options={FONTES} value={draft.fontes} onChange={(v) => onChange({ ...draft, fontes: v })} />
      </Field>
      <p className="text-xs text-muted-foreground">
        As credenciais de cada canal e fonte são configuradas por Arthur em Setup → Integrações.
      </p>
    </div>
  )
}
