/** Monograma do Maestro: "M" com filete dourado. `escuro` serve para fundos claros; o padrão (creme) serve para a lateral marinha. */
export function Logo({ className = 'size-9', escuro = false }: { className?: string; escuro?: boolean }) {
  return (
    <div
      className={`display flex shrink-0 items-center justify-center rounded-[10px] border-b-[3px] border-gold text-lg font-extrabold ${escuro ? 'bg-navy text-cream' : 'bg-cream text-navy'} ${className}`}
      aria-hidden="true"
    >
      M
    </div>
  )
}
