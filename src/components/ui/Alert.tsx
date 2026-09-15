import type { ReactNode } from 'react'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<Tone, { box: string; icon: string }> = {
  info: { box: 'border-sky bg-sky/60 text-navy-900', icon: 'bi-info-circle' },
  success: { box: 'border-mint bg-mint/70 text-forest-900', icon: 'bi-check-circle' },
  warning: { box: 'border-[#efd9a8] bg-amber-note text-gold-700', icon: 'bi-exclamation-triangle' },
  danger: { box: 'border-[#e9c3c0] bg-blush text-alarm-700', icon: 'bi-exclamation-octagon' },
}

export function Alert({ tone = 'info', title, children, className = '' }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  const t = TONES[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex gap-3 rounded-[14px] border px-4 py-3 text-sm ${t.box} ${className}`}>
      <i aria-hidden className={`bi ${t.icon} mt-0.5 text-base`} />
      <div className="min-w-0">
        {title && <p className="font-bold leading-snug">{title}</p>}
        {children && <div className={`leading-relaxed ${title ? 'mt-0.5' : ''}`}>{children}</div>}
      </div>
    </div>
  )
}
