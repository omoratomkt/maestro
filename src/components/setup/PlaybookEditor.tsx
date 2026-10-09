import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/campaigns/NewCampaignWizard/fields'
import { Step2ICP } from '@/components/campaigns/NewCampaignWizard/Step2ICP'
import { Step3Channels } from '@/components/campaigns/NewCampaignWizard/Step3Channels'
import { Step4Persona } from '@/components/campaigns/NewCampaignWizard/Step4Persona'
import { draftFromPlaybook, draftToPlaybook, emptyDraft, type CampaignDraft } from '@/components/campaigns/NewCampaignWizard/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { PlaybookRow } from '@/hooks/usePlaybooks'
import type { TablesInsert } from '@/types/database'

interface Props {
  playbook?: PlaybookRow
  onClose: () => void
  onSave: (input: TablesInsert<'playbooks'>) => Promise<void>
}

/** Editor de playbook: reaproveita os passos do wizard de campanha numa única tela. */
export function PlaybookEditor({ playbook, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<CampaignDraft>(playbook ? draftFromPlaybook(playbook) : emptyDraft)
  const [descricao, setDescricao] = useState(playbook?.descricao ?? '')
  const [icone, setIcone] = useState(playbook?.icone ?? '')
  const [ativo, setAtivo] = useState(playbook?.ativo ?? true)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!draft.nome.trim()) return toast.error('Dê um nome ao playbook.')
    setSaving(true)
    try {
      await onSave(draftToPlaybook(draft, { descricao, icone, ativo }))
      toast.success('Playbook salvo.')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar playbook')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{playbook ? 'Editar playbook' : 'Novo playbook'}</DialogTitle>
          <DialogDescription>Defaults que pré-preenchem o wizard de nova campanha.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Identificação</h3>
            <Field label="Nome">
              <Input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} />
            </Field>
            <Field label="Descrição">
              <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
              <Field label="Ícone (nome Lucide)" hint="Ex.: store, briefcase, users">
                <Input value={icone} onChange={(e) => setIcone(e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 pb-2 text-xs">
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                Ativo (aparece no wizard de campanhas)
              </label>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Fontes e canais padrão</h3>
            <Step3Channels draft={draft} onChange={setDraft} />
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">ICP base</h3>
            <Step2ICP hideName draft={draft} onChange={setDraft} />
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Persona e qualificação base</h3>
            <Step4Persona draft={draft} onChange={setDraft} />
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            Salvar playbook
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
