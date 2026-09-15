export function Spinner({ label, className = '', inverted = false }: { label?: string; className?: string; inverted?: boolean }) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 text-sm ${inverted ? 'text-white' : 'text-muted'} ${className}`}>
      <span aria-hidden className={`size-4 animate-spin rounded-full border-2 ${inverted ? 'border-white/35 border-t-white' : 'border-line border-t-accent'}`} />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  )
}

export function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <img src="/fnph-logo.png" alt="" className="size-16" />
        <Spinner label={label} />
      </div>
    </div>
  )
}
