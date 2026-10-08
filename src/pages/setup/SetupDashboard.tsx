import { Building2, Megaphone, Plug, Workflow } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { MetricCard } from '@/components/metrics/MetricCard'
import { supabase } from '@/lib/supabase'

export default function SetupDashboard() {
  const [counts, setCounts] = useState<number[] | null>(null)

  useEffect(() => {
    let active = true
    const h = { count: 'exact' as const, head: true }
    Promise.all([
      supabase.from('workspaces').select('id', h).eq('ativo', true),
      supabase.from('playbooks').select('id', h).eq('ativo', true),
      supabase.from('campanhas').select('id', h).eq('status', 'ativa'),
      supabase.from('integracoes').select('id', h).eq('ativo', true),
    ]).then((r) => active && setCounts(r.map((x) => x.count ?? 0)))
    return () => {
      active = false
    }
  }, [])

  return (
    <PageShell title="Setup" description="Visão geral da administração do Maestro">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Workspaces ativos" value={counts?.[0] ?? '—'} icon={Building2} />
        <MetricCard label="Playbooks ativos" value={counts?.[1] ?? '—'} icon={Workflow} />
        <MetricCard label="Campanhas ativas" value={counts?.[2] ?? '—'} icon={Megaphone} />
        <MetricCard label="Integrações ativas" value={counts?.[3] ?? '—'} icon={Plug} />
      </div>
    </PageShell>
  )
}
