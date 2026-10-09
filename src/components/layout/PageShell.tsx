import type { ReactNode } from 'react'
import { Header } from './Header'

interface PageShellProps {
  title: string
  description: string
  children?: ReactNode
}

/** Moldura comum das páginas: header + área de conteúdo. */
export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <>
      <Header title={title} description={description} />
      <div className="flex-1 overflow-auto p-4 sm:p-6">{children}</div>
    </>
  )
}

/** Estado vazio das páginas ainda sem dados (telas reais vêm nas próximas etapas). */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  )
}
