import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { Prospect } from '@/hooks/useProspects'
import { ALL_PROSPECT_STATUS, CANAIS_INTERACAO, labelOf } from '@/lib/constants'

export function PipelineList({ prospects, onOpen }: { prospects: Prospect[]; onOpen: (p: Prospect) => void }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'score', desc: true }])
  const [filter, setFilter] = useState('')

  const columns = useMemo<ColumnDef<Prospect>[]>(
    () => [
      { accessorKey: 'nome_empresa', header: 'Empresa' },
      { accessorKey: 'nome_contato', header: 'Contato', cell: (c) => c.getValue<string | null>() ?? '—' },
      { accessorKey: 'cargo', header: 'Cargo', cell: (c) => c.getValue<string | null>() ?? '—' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (c) => <Badge variant="outline">{labelOf(ALL_PROSPECT_STATUS, c.getValue<string>())}</Badge>,
      },
      { accessorKey: 'score', header: 'Score', cell: (c) => c.getValue<number | null>() ?? '—' },
      {
        accessorKey: 'canal_principal',
        header: 'Canal',
        cell: (c) => {
          const v = c.getValue<string | null>()
          return v ? labelOf(CANAIS_INTERACAO, v) : '—'
        },
      },
      {
        id: 'local',
        header: 'Local',
        accessorFn: (p) => [p.cidade, p.estado].filter(Boolean).join(' - '),
        cell: (c) => c.getValue<string>() || '—',
      },
    ],
    [],
  )

  const table = useReactTable({
    data: prospects,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-3">
      <Input className="max-w-xs" placeholder="Filtrar prospects…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2 font-medium">
                    <button type="button" className="flex items-center gap-1" onClick={h.column.getToggleSortingHandler()}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      <ArrowUpDown className="size-3 text-muted-foreground" />
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => onOpen(row.original)}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhum prospect encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
