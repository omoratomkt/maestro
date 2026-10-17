/** Logomarca do Maestro (M de circuito). Troca sozinha com o tema: .logo-clara no claro, .logo-escura no escuro.
 *  `naLateral` usa sempre a versão clara, que lê bem sobre o marinho da barra lateral nos dois modos. */
export function Logo({ className = 'size-9', naLateral = false }: { className?: string; naLateral?: boolean }) {
  if (naLateral) return <img src="/logo-clara.png" alt="" width={36} height={36} className={`shrink-0 ${className}`} />
  return (
    <>
      <img src="/logo-clara.png" alt="" width={36} height={36} className={`logo-clara shrink-0 ${className}`} />
      <img src="/logo-escura.png" alt="" width={36} height={36} className={`logo-escura shrink-0 ${className}`} />
    </>
  )
}
