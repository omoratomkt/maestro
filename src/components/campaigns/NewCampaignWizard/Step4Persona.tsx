import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TONS } from '@/lib/constants'
import { ChipRadio, Field, TagInput } from './fields'
import type { CampaignDraft } from './types'

interface Props {
  draft: CampaignDraft
  onChange: (d: CampaignDraft) => void
}

export function Step4Persona({ draft, onChange }: Props) {
  const set = <K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]) => onChange({ ...draft, [k]: v })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nome da persona">
          <Input value={draft.persona_nome} onChange={(e) => set('persona_nome', e.target.value)} placeholder="Ex.: Arthur" />
        </Field>
        <Field label="Produto / serviço oferecido">
          <Input value={draft.persona_produto} onChange={(e) => set('persona_produto', e.target.value)} placeholder="Ex.: Consultoria de IA" />
        </Field>
      </div>
      <Field label="Tom de voz">
        <ChipRadio options={TONS} value={draft.persona_tom} onChange={(v) => set('persona_tom', v)} />
      </Field>
      <Field label="Argumentos principais" hint="Enter para adicionar.">
        <TagInput value={draft.persona_argumentos} onChange={(v) => set('persona_argumentos', v)} placeholder="Ex.: Reduz o tempo de atendimento" />
      </Field>

      <Field label="Objeções e respostas">
        <div className="space-y-2">
          {draft.persona_objecoes.map((o, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="grid flex-1 gap-2">
                <Input
                  value={o.objecao}
                  placeholder="Objeção"
                  onChange={(e) => set('persona_objecoes', draft.persona_objecoes.map((x, j) => (j === i ? { ...x, objecao: e.target.value } : x)))}
                />
                <Textarea
                  value={o.resposta}
                  placeholder="Como responder"
                  rows={2}
                  onChange={(e) => set('persona_objecoes', draft.persona_objecoes.map((x, j) => (j === i ? { ...x, resposta: e.target.value } : x)))}
                />
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Remover objeção" onClick={() => set('persona_objecoes', draft.persona_objecoes.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set('persona_objecoes', [...draft.persona_objecoes, { objecao: '', resposta: '' }])}>
            <Plus /> Adicionar objeção
          </Button>
        </div>
      </Field>

      <Field label="Critérios de qualificação" hint="O lead só é qualificado quando todos os obrigatórios forem respondidos.">
        <div className="space-y-2">
          {draft.criterios_qualificacao.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="w-32"
                value={c.campo}
                placeholder="Campo"
                onChange={(e) => set('criterios_qualificacao', draft.criterios_qualificacao.map((x, j) => (j === i ? { ...x, campo: e.target.value } : x)))}
              />
              <Input
                value={c.pergunta}
                placeholder="Pergunta"
                onChange={(e) => set('criterios_qualificacao', draft.criterios_qualificacao.map((x, j) => (j === i ? { ...x, pergunta: e.target.value } : x)))}
              />
              <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={c.obrigatorio}
                  onChange={(e) => set('criterios_qualificacao', draft.criterios_qualificacao.map((x, j) => (j === i ? { ...x, obrigatorio: e.target.checked } : x)))}
                />
                Obrigatório
              </label>
              <Button type="button" variant="ghost" size="icon" aria-label="Remover critério" onClick={() => set('criterios_qualificacao', draft.criterios_qualificacao.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set('criterios_qualificacao', [...draft.criterios_qualificacao, { campo: '', pergunta: '', obrigatorio: true }])}>
            <Plus /> Adicionar critério
          </Button>
        </div>
      </Field>
    </div>
  )
}
