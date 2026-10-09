import { Download, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Prospect } from '@/hooks/useProspects'
import { supabase } from '@/lib/supabase'
import { normalizarSupressao } from '@/lib/suppression'

/** Direitos do titular (LGPD): baixar todos os dados de um prospect e excluí-lo com todo o histórico. */
export function ProspectActions({ prospect: p, onDeleted }: { prospect: Prospect; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [bloquear, setBloquear] = useState(true)
  const [busy, setBusy] = useState(false)

  async function baixar() {
    const [interacoes, estado, lead, fila] = await Promise.all([
      supabase.from('prospect_interacoes').select('*').eq('prospect_id', p.id).order('enviado_em'),
      supabase.from('prospect_estado').select('*').eq('prospect_id', p.id).maybeSingle(),
      supabase.from('leads_qualificados').select('*').eq('prospect_id', p.id).maybeSingle(),
      supabase.from('fila_acoes').select('*').eq('prospect_id', p.id).order('criado_em'),
    ])
    const dados = { exportado_em: new Date().toISOString(), prospect: p, interacoes: interacoes.data, estado_do_agente: estado.data, lead_qualificado: lead.data, acoes_propostas: fila.data }
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `prospect-${p.nome_empresa.replace(/[^\w-]+/g, '_').slice(0, 40)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function excluir() {
    setBusy(true)
    try {
      if (bloquear) {
        const rows = (
          [
            ['email', p.email],
            ['whatsapp', p.whatsapp],
            ['linkedin', p.linkedin_url],
            ['instagram', p.instagram_handle],
          ] as const
        )
          .filter(([, v]) => v && v.trim())
          .map(([tipo, v]) => ({ workspace_id: p.workspace_id, tipo, valor: normalizarSupressao(tipo, v!), motivo: 'Exclusão a pedido', origem: 'manual' }))
        if (rows.length) {
          const { error } = await supabase.from('supressoes').upsert(rows, { onConflict: 'workspace_id,tipo,valor', ignoreDuplicates: true })
          if (error) throw new Error(error.message)
        }
      }
      // O lead não tem exclusão em cascata (é registro comercial): sai primeiro. O resto (mensagens, estado, ações) cai junto com o prospect.
      const lead = await supabase.from('leads_qualificados').delete().eq('prospect_id', p.id)
      if (lead.error) throw new Error(lead.error.message)
      const r = await supabase.from('prospects').delete().eq('id', p.id)
      if (r.error) throw new Error(r.error.message)
      toast.success('Prospect e histórico excluídos.')
      setOpen(false)
      onDeleted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="flex flex-wrap gap-2 border-t pt-4">
        <Button size="sm" variant="outline" onClick={() => baixar().catch((e) => toast.error(e.message))}>
          <Download /> Baixar dados (JSON)
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Trash2 /> Excluir prospect
        </Button>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir {p.nome_empresa}?</DialogTitle>
            <DialogDescription>
              Apaga o prospect, todas as mensagens, o estado do agente, as ações propostas e o lead qualificado. Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" className="mt-0.5" checked={bloquear} onChange={(e) => setBloquear(e.target.checked)} />
            <span>
              <b>Impedir que este contato volte</b> (adiciona email, WhatsApp, LinkedIn e Instagram à lista de supressão). Sem isso, uma nova busca pode
              encontrá-lo de novo.
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={excluir} disabled={busy}>
              Excluir definitivamente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
