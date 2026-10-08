import { Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/campaigns/NewCampaignWizard/fields'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Integracao } from '@/hooks/useIntegrations'
import { maskSecret, randomSecret, type IntegrationDef } from '@/lib/integrations'
import type { Json } from '@/types/database'

interface Props {
  def: IntegrationDef
  workspaceId: string
  current?: Integracao
  onClose: () => void
  onSave: (config: Record<string, Json>, ativo: boolean) => Promise<void>
  onRemove?: () => Promise<void>
}

export function IntegrationForm({ def, workspaceId, current, onClose, onSave, onRemove }: Props) {
  const saved = (current?.config ?? {}) as Record<string, Json>
  const [values, setValues] = useState<Record<string, string>>(
    // Campos secretos começam vazios: em branco = manter o valor salvo.
    Object.fromEntries(def.fields.map((f) => [f.key, f.secret ? '' : String(saved[f.key] ?? '')])),
  )
  const [ativo, setAtivo] = useState(current?.ativo ?? true)
  const [saving, setSaving] = useState(false)

  const secretForUrl = values.webhook_secret || (typeof saved.webhook_secret === 'string' ? saved.webhook_secret : '')
  const webhookUrl = def.webhook
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${def.webhook}?ws=${workspaceId}&token=${secretForUrl || '<segredo>'}`
    : null

  async function submit() {
    const config: Record<string, Json> = { ...saved }
    for (const f of def.fields) {
      const v = values[f.key].trim()
      if (v) config[f.key] = v
      else if (!f.secret) delete config[f.key]
    }
    const missing = def.fields.filter((f) => !f.optional && !config[f.key])
    if (missing.length) return toast.error(`Preencha: ${missing.map((m) => m.label).join(', ')}.`)

    setSaving(true)
    try {
      await onSave(config, ativo)
      toast.success('Integração salva.')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{def.label}</DialogTitle>
          <DialogDescription>{def.note ?? 'Credenciais deste workspace. Valores salvos nunca são exibidos por inteiro.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {def.fields.map((f) => (
            <Field
              key={f.key}
              label={`${f.label}${f.optional ? ' (opcional)' : ''}`}
              hint={[f.hint, f.secret && saved[f.key] ? `Salvo: ${maskSecret(saved[f.key])}. Deixe em branco para manter.` : null].filter(Boolean).join(' ') || undefined}
            >
              <div className="flex gap-2">
                <Input
                  type={f.secret && f.key !== 'webhook_secret' ? 'password' : 'text'}
                  autoComplete="off"
                  placeholder={f.placeholder}
                  value={values[f.key]}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
                {f.key === 'webhook_secret' ? (
                  <Button type="button" variant="outline" onClick={() => setValues({ ...values, webhook_secret: randomSecret() })}>
                    Gerar
                  </Button>
                ) : null}
              </div>
            </Field>
          ))}

          {webhookUrl ? (
            <Field label="URL do webhook (cole no provedor)" hint="Só funciona depois de salvar. Trate como senha: contém o segredo.">
              <div className="flex gap-2">
                <Input readOnly value={webhookUrl} onFocus={(e) => e.currentTarget.select()} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copiar URL"
                  disabled={!secretForUrl}
                  onClick={() => navigator.clipboard.writeText(webhookUrl).then(() => toast.success('URL copiada.'))}
                >
                  <Copy />
                </Button>
              </div>
            </Field>
          ) : null}

          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativa
          </label>
        </div>
        <div className="flex justify-between gap-2">
          {current && onRemove ? (
            <Button
              variant="ghost"
              disabled={saving}
              onClick={async () => {
                if (!window.confirm(`Remover as credenciais de ${def.label}?`)) return
                try {
                  await onRemove()
                  toast.success('Integração removida.')
                  onClose()
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Erro ao remover')
                }
              }}
            >
              Remover
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
