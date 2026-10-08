import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth'
import type { TablesInsert } from '@/types/database'
import { Step1Playbook } from './Step1Playbook'
import { Step2ICP } from './Step2ICP'
import { Step3Channels } from './Step3Channels'
import { Step4Persona } from './Step4Persona'
import { Step5Review } from './Step5Review'
import { draftToInsert, emptyDraft, validateStep, type CampaignDraft } from './types'

const STEPS = ['Playbook', 'ICP', 'Canais e fontes', 'Persona', 'Revisar e lançar']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: TablesInsert<'campanhas'>) => Promise<void>
}

export function NewCampaignWizard({ open, onOpenChange, onCreate }: Props) {
  const { workspaceId } = useAuth()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<CampaignDraft>(emptyDraft)
  const [saving, setSaving] = useState(false)

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setStep(0)
      setDraft(emptyDraft)
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
      await onCreate(draftToInsert(draft, workspaceId, status))
      toast.success(status === 'ativa' ? 'Campanha lançada.' : 'Rascunho salvo.')
      close(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar campanha')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova campanha</DialogTitle>
          <DialogDescription>
            Passo {step + 1} de {STEPS.length}: {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
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
          <Button variant="ghost" disabled={step === 0 || saving} onClick={() => setStep(step - 1)}>
            Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Continuar</Button>
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
