import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Campanha } from '@/hooks/useCampaigns'
import { useAuth } from '@/lib/auth'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import { Step1Playbook } from './Step1Playbook'
import { Step2ICP } from './Step2ICP'
import { Step3Channels } from './Step3Channels'
import { Step4Persona } from './Step4Persona'
import { Step5Review } from './Step5Review'
import { campanhaToDraft, draftToInsert, emptyDraft, validateStep, type CampaignDraft } from './types'

const STEPS = ['Playbook', 'ICP', 'Canais e fontes', 'Persona', 'Revisar e lançar']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: TablesInsert<'campanhas'>) => Promise<void>
  /** Se informado, o wizard edita esta campanha (sem o passo de playbook). */
  campaign?: Campanha
  onUpdate?: (id: string, patch: TablesUpdate<'campanhas'>) => Promise<void>
}

export function NewCampaignWizard({ open, onOpenChange, onCreate, campaign, onUpdate }: Props) {
  const { workspaceId } = useAuth()
  const editing = Boolean(campaign)
  const first = editing ? 1 : 0
  const [step, setStep] = useState(first)
  const [draft, setDraft] = useState<CampaignDraft>(campaign ? campanhaToDraft(campaign) : emptyDraft)
  const [saving, setSaving] = useState(false)

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setStep(first)
      setDraft(campaign ? campanhaToDraft(campaign) : emptyDraft)
    }
  }

  function next() {
    const err = validateStep(step, draft)
    if (err) return toast.error(err)
    setStep(step + 1)
  }

  async function save(status: 'rascunho' | 'ativa') {
    if (!workspaceId) return toast.error('Usuário sem workspace vinculado.')
    for (const s of [1, 2, 3]) {
      const err = validateStep(s, draft)
      if (err) {
        setStep(s)
        return toast.error(err)
      }
    }
    setSaving(true)
    try {
      if (campaign && onUpdate) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { workspace_id, status: _status, playbook_id, ...patch } = draftToInsert(draft, workspaceId, status)
        await onUpdate(campaign.id, { ...patch, atualizado_em: new Date().toISOString() })
        toast.success('Campanha atualizada.')
      } else {
        await onCreate(draftToInsert(draft, workspaceId, status))
        toast.success(status === 'ativa' ? 'Campanha lançada.' : 'Rascunho salvo.')
      }
      close(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar campanha')
    } finally {
      setSaving(false)
    }
  }

  const visible = STEPS.length - first
  const position = step - first + 1

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar campanha' : 'Nova campanha'}</DialogTitle>
          <DialogDescription>
            Passo {position} de {visible}: {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1">
          {STEPS.slice(first).map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${i < position ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {step === 0 && <Step1Playbook draft={draft} onChange={setDraft} />}
          {step === 1 && <Step2ICP draft={draft} onChange={setDraft} />}
          {step === 2 && <Step3Channels draft={draft} onChange={setDraft} />}
          {step === 3 && <Step4Persona draft={draft} onChange={setDraft} />}
          {step === 4 && <Step5Review draft={draft} />}
        </div>

        <div className="flex justify-between gap-2 border-t pt-3">
          <Button variant="ghost" disabled={step === first || saving} onClick={() => setStep(step - 1)}>
            Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Continuar</Button>
          ) : editing ? (
            <Button disabled={saving} onClick={() => save('rascunho')}>
              Salvar alterações
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" disabled={saving} onClick={() => save('rascunho')}>
                Salvar rascunho
              </Button>
              <Button disabled={saving} onClick={() => save('ativa')}>
                Lançar campanha
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
