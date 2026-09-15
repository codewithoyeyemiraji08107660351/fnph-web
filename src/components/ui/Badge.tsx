import type { ReactNode } from 'react'

type Tone = 'green' | 'navy' | 'gold' | 'red' | 'grey'

const TONES: Record<Tone, string> = {
  green: 'bg-mint text-forest',
  navy: 'bg-sky text-navy',
  gold: 'bg-sand text-gold-700',
  red: 'bg-blush text-alarm',
  grey: 'bg-soft text-muted',
}

export function Badge({ tone = 'grey', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-bold whitespace-nowrap ${TONES[tone]}`}>{children}</span>
}

export function StatusBadge({ status }: { status?: string }) {
  switch (status) {
    case 'ACTIVE':
      return <Badge tone="green">Active</Badge>
    case 'INVITED':
      return <Badge tone="gold">Invitation pending</Badge>
    case 'SUSPENDED':
      return <Badge tone="red">Suspended</Badge>
    case 'DEACTIVATED':
      return <Badge tone="grey">Deactivated</Badge>
    default:
      return <Badge>{status ?? 'Unknown'}</Badge>
  }
}
