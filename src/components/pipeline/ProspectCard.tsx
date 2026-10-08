import { Building2, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Prospect } from '@/hooks/useProspects'
import { CANAIS_INTERACAO, labelOf } from '@/lib/constants'

export function ProspectCard({ prospect: p }: { prospect: Prospect }) {
  const local = [p.cidade, p.estado].filter(Boolean).join(' - ')
  return (
    <div className="space-y-1.5 rounded-md border bg-card p-2.5 text-xs shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium leading-snug">
          <Building2 className="size-3 shrink-0 text-muted-foreground" />
          {p.nome_empresa}
        </p>
        {p.score !== null ? <Badge variant="secondary">{p.score}</Badge> : null}
      </div>
      {p.nome_contato ? (
        <p className="text-muted-foreground">
          {p.nome_contato}
          {p.cargo ? ` · ${p.cargo}` : ''}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
        {local ? (
          <span className="flex items-center gap-1">
            <MapPin className="size-3" /> {local}
          </span>
        ) : null}
        {p.canal_principal ? <Badge variant="outline">{labelOf(CANAIS_INTERACAO, p.canal_principal)}</Badge> : null}
      </div>
    </div>
  )
}
