import { KanbanSquare, List, Upload } from 'lucide-react'
import { useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { CsvImportDialog } from '@/components/pipeline/CsvImportDialog'
import { PipelineKanban } from '@/components/pipeline/PipelineKanban'
import { PipelineList } from '@/components/pipeline/PipelineList'
import { ProspectDrawer } from '@/components/pipeline/ProspectDrawer'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useProspects, type Prospect } from '@/hooks/useProspects'
import { toast } from 'sonner'

export default function Pipeline() {
  const { prospects, loading, error, truncated, loadMore, setStatus, importMany, reload } = useProspects()
  const { campanhas } = useCampaigns()
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [campanhaId, setCampanhaId] = useState<string>('')
  const visiveis = campanhaId ? prospects.filter((p) => p.campanha_id === campanhaId) : prospects

  // O drawer lê do estado vivo, então o status muda também nele ao arrastar.
  const selected: Prospect | null = prospects.find((p) => p.id === selectedId) ?? null

  async function move(id: string, status: string) {
    await setStatus(id, status)
  }

  return (
    <PageShell title="Pipeline" description="Prospects por status, do novo ao convertido">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <Button size="sm" variant={view === 'kanban' ? 'default' : 'outline'} onClick={() => setView('kanban')}>
            <KanbanSquare /> Kanban
          </Button>
          <Button size="sm" variant={view === 'lista' ? 'default' : 'outline'} onClick={() => setView('lista')}>
            <List /> Lista
          </Button>
        </div>
        <select
          aria-label="Filtrar por campanha"
          className="h-8 rounded-lg border bg-background px-2 text-sm"
          value={campanhaId}
          onChange={(e) => setCampanhaId(e.target.value)}
        >
          <option value="">Todas as campanhas</option>
          {campanhas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (campanhas.length ? setImporting(true) : toast.error('Crie uma campanha antes de importar prospects.'))}
        >
          <Upload /> Importar CSV
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">Erro ao carregar prospects: {error}</p> : null}
      {truncated ? (
        <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
          Mostrando os {prospects.length} prospects de maior score.
          <Button size="sm" variant="outline" onClick={loadMore}>
            Carregar mais 1000
          </Button>
        </div>
      ) : null}

      {loading ? (
        <Skeleton className="h-64" />
      ) : prospects.length === 0 && !error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-muted-foreground">
          Nenhum prospect ainda.
          <span className="text-xs">Importe um CSV ou ative uma fonte de busca em uma campanha.</span>
        </div>
      ) : view === 'kanban' ? (
        <PipelineKanban prospects={visiveis} onMove={move} onOpen={(p) => setSelectedId(p.id)} />
      ) : (
        <PipelineList prospects={visiveis} onOpen={(p) => setSelectedId(p.id)} />
      )}

      <ProspectDrawer
        prospect={selected}
        onClose={() => setSelectedId(null)}
        onStatus={move}
        onChanged={() => void reload()}
        onDeleted={() => {
          setSelectedId(null)
          void reload()
        }}
      />
      {importing ? <CsvImportDialog campanhas={campanhas} onClose={() => setImporting(false)} onImport={importMany} /> : null}
    </PageShell>
  )
}
