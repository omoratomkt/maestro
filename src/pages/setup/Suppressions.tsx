import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWorkspaces } from '@/hooks/useIntegrations'
import { useAuth } from '@/lib/auth'
import { normalizarSupressao, TIPOS_SUPRESSAO } from '@/lib/suppression'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

type Supressao = Tables<'supressoes'>

export default function Suppressions() {
  const { workspaces } = useWorkspaces()
  const ativo = useAuth().workspaceId
  const [chosen, setChosen] = useState<string | null>(null)
  const workspaceId = chosen ?? ativo ?? workspaces[0]?.id ?? null
  const [items, setItems] = useState<Supressao[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tipo, setTipo] = useState('email')
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')

  const load = useCallback(async () => {
    if (!workspaceId) return
    const { data, error: err } = await supabase.from('supressoes').select('*').eq('workspace_id', workspaceId).order('criado_em', { ascending: false }).limit(1000)
    if (err) setError(err.message)
    else {
      setError(null)
      setItems(data)
    }
  }, [workspaceId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!workspaceId) return
    const v = normalizarSupressao(tipo, valor)
    if (!v) return toast.error('Informe o valor.')
    const { error: err } = await supabase
      .from('supressoes')
      .upsert({ workspace_id: workspaceId, tipo, valor: v, motivo: motivo.trim() || null, origem: 'manual' }, { onConflict: 'workspace_id,tipo,valor', ignoreDuplicates: true })
    if (err) return toast.error(err.message)
    toast.success('Adicionado à lista. Esse contato não receberá mais mensagens.')
    setValor('')
    setMotivo('')
    await load()
  }

  async function remove(s: Supressao) {
    if (!window.confirm(`Remover ${s.valor} da lista? Ele poderá voltar a ser contatado.`)) return
    const { error: err } = await supabase.from('supressoes').delete().eq('id', s.id)
    if (err) return toast.error(err.message)
    await load()
  }

  return (
    <PageShell title="Lista de supressão" description="Contatos que nunca devem receber mensagens (opt-out / LGPD)">
      <div className="mb-4 flex items-center gap-2 text-sm">
        <label className="text-xs font-medium">Workspace</label>
        <select className="h-8 rounded-lg border bg-background px-2.5 text-sm" value={workspaceId ?? ''} onChange={(e) => setChosen(e.target.value)}>
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.nome}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-4 max-w-2xl text-xs text-muted-foreground">
        Quem pede para parar de receber mensagens entra aqui automaticamente. Também vale para quem você adicionar à mão: o Maestro não busca, não propõe e não envia para esses contatos, em nenhum canal ou campanha. Um domínio bloqueia a empresa inteira.
      </p>

      <form onSubmit={add} className="mb-6 flex flex-wrap gap-2">
        <select className="h-8 rounded-lg border bg-background px-2 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS_SUPRESSAO.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <Input className="w-64" required placeholder="Valor (email, número, link, @, domínio)" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Input className="w-56" placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <Button type="submit">
          <Plus /> Adicionar
        </Button>
      </form>

      {error ? <p className="text-sm text-destructive">Erro ao carregar: {error}</p> : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Valor</th>
              <th className="px-3 py-2 font-medium">Motivo</th>
              <th className="px-3 py-2 font-medium">Origem</th>
              <th className="px-3 py-2 font-medium">Desde</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">{TIPOS_SUPRESSAO.find((t) => t.value === s.tipo)?.label ?? s.tipo}</td>
                <td className="px-3 py-2 font-mono">{s.valor}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.motivo ?? '—'}</td>
                <td className="px-3 py-2">{s.origem === 'resposta' ? 'Pediu para sair' : s.origem === 'importacao' ? 'Importação' : 'Manual'}</td>
                <td className="px-3 py-2">{new Date(s.criado_em).toLocaleDateString('pt-BR')}</td>
                <td className="px-2 py-1 text-right">
                  <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => remove(s)}>
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Ninguém na lista.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageShell>
  )
}
