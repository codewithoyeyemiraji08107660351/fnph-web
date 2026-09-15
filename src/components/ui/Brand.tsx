import { Link } from 'react-router-dom'

export function Brand({ subtitle = 'Telepsychiatry System', to = '/', inverted = false }: { subtitle?: string; to?: string; inverted?: boolean }) {
  return (
    <Link to={to} className="flex min-w-max items-center gap-3 no-underline">
      <img src="/fnph-logo.png" alt="Federal Neuropsychiatric Hospital Kaduna" width={48} height={48} className="size-11 sm:size-12" />
      <span className="leading-tight">
        <strong className={`block font-display text-[0.95rem] font-extrabold ${inverted ? 'text-white' : 'text-ink'}`}>FNPH Kaduna</strong>
        <small className={`block text-xs ${inverted ? 'text-white/70' : 'text-muted'}`}>{subtitle}</small>
      </span>
    </Link>
  )
}
