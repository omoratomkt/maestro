import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Chama `onChange` (com debounce) sempre que alguma das tabelas mudar para o usuário (Supabase Realtime, respeitando o RLS).
 * Também recarrega ao voltar o foco para a aba, que cobre conexões que caíram.
 */
export function useTableChanges(tables: string[], onChange: () => void) {
  const latest = useRef(onChange)
  useEffect(() => {
    latest.current = onChange
  })

  const key = tables.join(',')
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const fire = () => {
      clearTimeout(timer)
      timer = setTimeout(() => latest.current(), 600)
    }
    const channel = supabase.channel(`rt-${key}-${Math.random().toString(36).slice(2)}`)
    for (const table of key.split(',')) channel.on('postgres_changes', { event: '*', schema: 'public', table }, fire)
    channel.subscribe()
    window.addEventListener('focus', fire)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', fire)
      void supabase.removeChannel(channel)
    }
  }, [key])
}
