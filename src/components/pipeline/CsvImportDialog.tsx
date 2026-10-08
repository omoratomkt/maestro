import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Campanha } from '@/hooks/useCampaigns'
import { useAuth } from '@/lib/auth'
import { parseCsv } from '@/lib/csv'
import type { TablesInsert } from '@/types/database'

const COLUMNS = [
  'nome_empresa',
  'nome_contato',
  'cargo',
  'whatsapp',
  'email',
  'linkedin_url',
  'instagram_handle',
  'website',
  'segmento',
  'cidade',
  'estado',
  'cnpj',
] as const

type Col = (typeof COLUMNS)[number]

interface Props {
  campanhas: Campanha[]
  onClose: () => void
  onImport: (rows: TablesInsert<'prospects'>[]) => Promise<void>
}

export function CsvImportDialog({ campanhas, onClose, onImport }: Props) {
  const { workspaceId } = useAuth()
  const [campanhaId, setCampanhaId] = useState(campanhas[0]?.id ?? '')
  const [rows, setRows] = useState<TablesInsert<'prospects'>[]>([])
  const [skipped, setSkipped] = useState(0)
  const [fileError, setFileError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onFile(file: File | undefined) {
    setRows([])
    setSkipped(0)
    setFileError(null)
    if (!file || !workspaceId || !campanhaId) return
    const table = parseCsv(await file.text())
    const header = (table[0] ?? []).map((h) => h.trim().toLowerCase())
    if (!header.includes('nome_empresa')) {
      setFileError('A primeira linha precisa ter a coluna "nome_empresa".')
      return
    }
    const idx = Object.fromEntries(COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<Col, number>
    const out: TablesInsert<'prospects'>[] = []
    let skip = 0
    for (const r of table.slice(1)) {
      const get = (c: Col) => (idx[c] >= 0 ? r[idx[c]]?.trim() || null : null)
      const nome = get('nome_empresa')
      if (!nome) {
        skip++
        continue
      }
      out.push({
        workspace_id: workspaceId,
        campanha_id: campanhaId,
        nome_empresa: nome,
        nome_contato: get('nome_contato'),
        cargo: get('cargo'),
        whatsapp: get('whatsapp'),
        email: get('email'),
        linkedin_url: get('linkedin_url'),
        instagram_handle: get('instagram_handle'),
        website: get('website'),
        segmento: get('segmento'),
        cidade: get('cidade'),
        estado: get('estado'),
        cnpj: get('cnpj'),
        fonte: 'csv',
      })
    }
    setRows(out)
    setSkipped(skip)
  }

  async function submit() {
    setSaving(true)
    try {
      await onImport(rows.map((r) => ({ ...r, campanha_id: campanhaId })))
      toast.success(`${rows.length} prospects importados.`)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao importar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar CSV</DialogTitle>
          <DialogDescription>
            Colunas aceitas: {COLUMNS.join(', ')}. Só <b>nome_empresa</b> é obrigatória.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div className="space-y-1.5">
            <label className="font-medium">Campanha de destino</label>
            <select
              className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm"
              value={campanhaId}
              onChange={(e) => {
                setCampanhaId(e.target.value)
                setRows([])
              }}
            >
              {campanhas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="font-medium">Arquivo .csv</label>
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          {fileError ? <p className="text-destructive">{fileError}</p> : null}
          {rows.length > 0 ? (
            <p className="text-muted-foreground">
              {rows.length} prospects prontos para importar{skipped ? ` (${skipped} linhas sem nome_empresa ignoradas)` : ''}.
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || rows.length === 0}>
            Importar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
