import { Plus } from 'lucide-react'
import { useState } from 'react'
import { CampaignCard } from '@/components/campaigns/CampaignCard'
import { NewCampaignWizard } from '@/components/campaigns/NewCampaignWizard/NewCampaignWizard'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCampaigns } from '@/hooks/useCampaigns'

export default function Campaigns() {
  const { campanhas, loading, error, create, setStatus } = useCampaigns()
  const [open, setOpen] = useState(false)

  return (
    <PageShell title="Campanhas" description="Campanhas ativas e criação de novas">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus /> Nova campanha
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">Erro ao carregar campanhas: {error}</p> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : campanhas.length === 0 && !error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-sm text-muted-foreground">
          Nenhuma campanha ainda.
          <Button variant="outline" onClick={() => setOpen(true)}>
            Criar a primeira campanha
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campanhas.map((c) => (
            <CampaignCard key={c.id} campanha={c} onStatus={setStatus} />
          ))}
        </div>
      )}

      <NewCampaignWizard open={open} onOpenChange={setOpen} onCreate={create} />
    </PageShell>
  )
}
