import type { Ticket } from '@/lib/api/endpoints/support'
import { formatDateTime, humanise } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'

export function TicketStatusBadge({ status }: { status: Ticket['status'] }) {
  const tone = status === 'RESOLVED' || status === 'CLOSED' ? 'green' : status === 'ESCALATED' ? 'red' : status === 'AWAITING_REQUESTER' ? 'gold' : 'navy'
  return <Badge tone={tone}>{humanise(status)}</Badge>
}

export function TicketThread({ ticket }: { ticket: Ticket }) {
  return (
    <ol className="space-y-2">
      {ticket.messages.map((m, i) => (
        <li key={i} className={`rounded-[12px] px-3 py-2 text-sm ${m.internal ? 'border border-dashed border-gold bg-amber-note' : 'bg-canvas'}`}>
          <p className="text-xs text-muted">
            <strong className="text-ink">{m.author}</strong> {formatDateTime(m.sentAt)}{m.internal ? '. Internal note, not shown to the requester' : ''}
          </p>
          <p className="mt-1 whitespace-pre-line">{m.body}</p>
        </li>
      ))}
      {ticket.resolutionSummary && <li className="rounded-[12px] bg-mint px-3 py-2 text-sm text-forest-900"><strong>Resolved:</strong> {ticket.resolutionSummary}</li>}
    </ol>
  )
}
