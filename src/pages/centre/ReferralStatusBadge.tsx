import { Badge } from '@/components/ui/Badge'
import type { ReferralStatus } from '@/lib/api/types'

// RETURNED means FNPH is asking for something. It is never shown as a rejection.
const MAP: Record<ReferralStatus, { tone: 'green' | 'navy' | 'gold' | 'red' | 'grey'; label: string }> = {
  DRAFT: { tone: 'grey', label: 'Draft, not sent' },
  SUBMITTED: { tone: 'navy', label: 'Sent to FNPH' },
  SCHEDULED: { tone: 'green', label: 'Consultation requested' },
  RETURNED: { tone: 'gold', label: 'Returned for more information' },
  COMPLETED: { tone: 'green', label: 'Completed' },
  WITHDRAWN: { tone: 'grey', label: 'Withdrawn' },
}

export function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  const m = MAP[status] ?? { tone: 'grey' as const, label: status }
  return <Badge tone={m.tone}>{m.label}</Badge>
}
