import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Quantidade de ações pendentes na fila de supervisão (badge da sidebar). */
export function usePendingQueueCount() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    supabase
      .from('fila_acoes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .then(({ count: c, error }) => {
        if (active && !error) setCount(c ?? 0)
      })
    return () => {
      active = false
    }
  }, [])

  return count
}
