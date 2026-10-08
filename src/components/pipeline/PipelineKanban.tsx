import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import type { Prospect } from '@/hooks/useProspects'
import { PIPELINE_STATUS } from '@/lib/constants'
import { ProspectCard } from './ProspectCard'

interface Props {
  prospects: Prospect[]
  onMove: (id: string, status: string) => Promise<void>
  onOpen: (p: Prospect) => void
}

export function PipelineKanban({ prospects, onMove, onOpen }: Props) {
  async function onDragEnd(r: DropResult) {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return
    try {
      await onMove(r.draggableId, r.destination.droppableId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível mover o prospect')
    }
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {PIPELINE_STATUS.map((col) => {
          const items = prospects.filter((p) => p.status === col.value)
          return (
            <div key={col.value} className="flex w-64 shrink-0 flex-col rounded-lg bg-muted/50">
              <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold">
                {col.label}
                <span className="font-normal text-muted-foreground">{items.length}</span>
              </div>
              <Droppable droppableId={col.value}>
                {(drop, snap) => (
                  <div
                    ref={drop.innerRef}
                    {...drop.droppableProps}
                    className={`min-h-24 flex-1 space-y-2 rounded-b-lg p-2 transition-colors ${snap.isDraggingOver ? 'bg-muted' : ''}`}
                  >
                    {items.map((p, index) => (
                      <Draggable key={p.id} draggableId={p.id} index={index}>
                        {(drag) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            onClick={() => onOpen(p)}
                            className="cursor-pointer"
                          >
                            <ProspectCard prospect={p} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {drop.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
