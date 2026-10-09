import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Prospect } from '@/hooks/useProspects'
import { callFunction } from '@/lib/functions'

const PARTES = [
  { chave: 'contactabilidade', label: 'Contactabilidade', max: 30 },
  { chave: 'aderencia_icp', label: 'Aderência ao ICP', max: 25 },
  { chave: 'presenca_digital', label: 'Presença digital', max: 25 },
  { chave: 'maturidade', label: 'Maturidade', max: 20 },
] as const

const SINAIS: Record<string, string> = {
  inauguracao_recente: 'Inauguração recente',
  avaliacoes_negativas: 'Avaliações negativas no Google',
  site_fora_do_ar: 'Site fora do ar',
}

/** Como o score foi calculado, o que o enriquecimento encontrou e o botão para refazer. */
export function EnrichmentPanel({ prospect: p, onChanged }: { prospect: Prospect; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const detalhes = (p.score_detalhes ?? {}) as Record<string, unknown>
  const dados = (p.dados_enriquecimento ?? {}) as Record<string, unknown>
  const etapas = (dados.etapas ?? {}) as Record<string, string>
  const tecnologias = Array.isArray(dados.tecnologias) ? (dados.tecnologias as string[]) : []
  const receita = (dados.cnpj ?? null) as { razao_social?: string; situacao?: string; abertura?: string; porte?: string; cnae?: string } | null
  const abertura = receita?.abertura ? new Date(receita.abertura) : null
  const meses = abertura && !Number.isNaN(abertura.getTime()) ? Math.floor((Date.now() - abertura.getTime()) / (30.44 * 24 * 3600e3)) : null
  const sinais = Object.keys((p.sinais_timing ?? {}) as Record<string, unknown>)

  async function reenriquecer() {
    setBusy(true)
    const r = await callFunction<{ score: number; status: string }>('prospect-enrich', { prospect_id: p.id })
    setBusy(false)
    if (!r.ok) return toast.error(`Não foi possível reenriquecer: ${r.error}`)
    toast.success(`Reenriquecido: score ${r.data?.score}${r.data?.status === 'descartado' ? ' (abaixo do mínimo: descartado)' : ''}.`)
    onChanged()
  }

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Enriquecimento e score</h3>
        <Button size="sm" variant="outline" disabled={busy} onClick={reenriquecer}>
          <RefreshCw className={busy ? 'animate-spin' : ''} /> {p.enriched_at ? 'Reenriquecer' : 'Enriquecer agora'}
        </Button>
      </div>

      {p.enriched_at ? (
        <>
          <div className="space-y-1.5">
            {PARTES.map((parte) => {
              const v = Number(detalhes[parte.chave] ?? 0)
              return (
                <div key={parte.chave} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-2">
                  <span className="text-muted-foreground">{parte.label}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, (v / parte.max) * 100)}%` }} />
                  </div>
                  <span className="text-right tabular-nums">
                    {v}/{parte.max}
                  </span>
                </div>
              )
            })}
            <p className="pt-1 font-medium">Score total: {p.score ?? '—'}/100</p>
          </div>
          {typeof detalhes.descarte === 'string' ? <p className="text-destructive">Descartado: {detalhes.descarte}</p> : null}

          {sinais.length ? (
            <div className="flex flex-wrap gap-1.5">
              {sinais.map((s) => (
                <Badge key={s} variant="secondary">
                  {SINAIS[s] ?? s}
                </Badge>
              ))}
            </div>
          ) : null}
          {receita ? (
            <div className="space-y-0.5">
              <p className="font-medium">Dados da empresa (Receita Federal)</p>
              {receita.razao_social ? <p>Razão social: {receita.razao_social}</p> : null}
              {receita.situacao ? <p>Situação: {receita.situacao}</p> : null}
              {abertura && meses !== null ? (
                <p>
                  Abertura: {abertura.toLocaleDateString('pt-BR')} ({meses < 24 ? `${meses} meses` : `${Math.floor(meses / 12)} anos`})
                </p>
              ) : null}
              {receita.porte ? <p>Porte: {receita.porte}</p> : null}
              {receita.cnae ? <p>Atividade: {receita.cnae}</p> : null}
            </div>
          ) : null}
          {tecnologias.length ? <p className="text-muted-foreground">Tecnologias do site: {tecnologias.join(', ')}</p> : null}

          {Object.keys(etapas).length ? (
            <details>
              <summary className="cursor-pointer text-muted-foreground">O que foi verificado</summary>
              <ul className="mt-1 space-y-0.5">
                {Object.entries(etapas).map(([nome, status]) => (
                  <li key={nome}>
                    <span className="font-medium">{nome}:</span> <span className={status.startsWith('erro') ? 'text-destructive' : 'text-muted-foreground'}>{status}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground">Ainda não enriquecido. O agente faz isso sozinho na próxima rodada, ou você pode antecipar.</p>
      )}
    </section>
  )
}
