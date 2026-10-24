import type { CentreReferralDetail } from '@/lib/api/types'
import { Badge } from '@/components/ui/Badge'

const FIELDS: Array<{ key: keyof CentreReferralDetail; label: string }> = [
  { key: 'reason', label: 'Reason for referral' },
  { key: 'assessment', label: 'Centre assessment' },
  { key: 'currentCondition', label: 'Current condition' },
  { key: 'relevantMedicines', label: 'Current and recent medicines' },
  { key: 'previousResults', label: 'Previous results' },
]

/**
 * Everything the centre wrote on the referral.
 *
 * The form asks for five things; FNPH staff used to see only the reason.
 */
export function ReferralDetail({ referral, fallbackReason }: { referral?: CentreReferralDetail | null; fallbackReason?: string | null }) {
  const filled = FIELDS.filter((f) => (referral?.[f.key] ?? '') !== '')
  if (!referral && !fallbackReason) return null
  return (
    <div className="space-y-3">
      {referral?.urgency && referral.urgency !== 'ROUTINE' && (
        <Badge tone={referral.urgency === 'URGENT' ? 'red' : 'gold'}>{referral.urgency === 'URGENT' ? 'Urgent' : 'Soon'}</Badge>
      )}
      {filled.length === 0 && fallbackReason && <p className="text-sm whitespace-pre-line">{fallbackReason}</p>}
      {filled.map((f) => (
        <div key={f.key}>
          <p className="text-xs font-bold tracking-wide text-muted uppercase">{f.label}</p>
          <p className="mt-0.5 text-sm whitespace-pre-line">{String(referral?.[f.key])}</p>
        </div>
      ))}
    </div>
  )
}
