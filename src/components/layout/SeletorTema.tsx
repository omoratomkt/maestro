import { useState } from 'react'

type Tema = 'light' | 'dark'

/**
 * O claro é sempre o padrão. O escuro só vale quando a pessoa o escolhe aqui,
 * e fica guardado neste navegador. Pensado para a lateral marinha.
 */
export function SeletorTema() {
  const [tema, setTema] = useState<Tema>(() => {
    try {
      return localStorage.getItem('tema') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  function aplicar(novo: Tema) {
    setTema(novo)
    const el = document.documentElement
    try {
      if (novo === 'light') {
        el.removeAttribute('data-theme')
        localStorage.removeItem('tema')
      } else {
        el.setAttribute('data-theme', 'dark')
        localStorage.setItem('tema', 'dark')
      }
    } catch {
      /* armazenamento indisponível: o tema vale só nesta visita */
    }
  }

  const opcoes: [Tema, string][] = [
    ['light', 'Claro'],
    ['dark', 'Escuro'],
  ]

  return (
    <div role="group" aria-label="Tema" className="inline-flex rounded-full border border-sidebar-foreground/25 p-0.5 text-[12px]">
      {opcoes.map(([v, rotulo]) => (
        <button
          key={v}
          type="button"
          onClick={() => aplicar(v)}
          aria-pressed={tema === v}
          className={`rounded-full px-3 py-1 font-semibold transition-colors ${
            tema === v ? 'bg-sidebar-foreground text-navy' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground'
          }`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  )
}
