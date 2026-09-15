import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { bookingApi } from '@/lib/api/endpoints/patient'
import type { Appointment } from '@/lib/api/types'
import { formatDateTime, formatTime, humanise, parseServerTime } from '@/lib/format'
import { useNow } from '@/lib/hooks/useNow'
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/Page'
import { AppointmentBadge } from '@/components/ui/AppointmentBadge'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

const JOINABLE = new Set(['APPROVED', 'IN_PROGRESS'])

function History({ id }: { id: string }) {
  const history = useQuery({ queryKey: ['appointment-history', id], queryFn: () => bookingApi.history(id) })
  if (history.isLoading) return <Spinner label="Loading history" />
  if (history.isError) return <p className="text-sm text-alarm">History could not be loaded.</p>
  return (
    <ol className="space-y-2 border-l-2 border-line pl-4">
      {history.data?.map((h, i) => (
        <li key={i} className="text-sm">
          <span className="font-bold">{humanise(h.toStatus)}</span> <span className="text-muted">{formatDateTime(h.changedAt)}</span>
          {h.reason && <span className="block text-muted">{h.reason}</span>}
        </li>
      ))}
    </ol>
  )
}

function Card({ a, highlighted }: { a: Appointment; highlighted: boolean }) {
  const now = useNow(15_000)
  const [open, setOpen] = useState(highlighted)
  const opensAt = parseServerTime(a.joinWindowOpensAt)?.getTime()
  const endsAt = parseServerTime(a.scheduledEndAt)?.getTime() ?? 0
  const canJoin = JOINABLE.has(a.status) && opensAt !== undefined && now >= opensAt && now < endsAt
  const held = a.status === 'SLOT_HELD' && (parseServerTime(a.heldUntil)?.getTime() ?? 0) > now

  return (
    <li className={`card p-5 ${highlighted ? 'ring-2 ring-accent' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-extrabold">{formatDateTime(a.appointmentDate)} WAT</p>
          <p className="text-sm text-muted">
            Reference {a.reference}
            {a.room ? `. ${a.room}` : ''}
          </p>
        </div>
        <AppointmentBadge status={a.status} />
      </div>

      {a.status === 'REJECTED' && a.rejectedReason && (
        <Alert tone="warning" className="mt-4" title="The hospital could not take this appointment">
          {a.rejectedReason} Your payment stays on your account as credit.
        </Alert>
      )}
      {a.status === 'AWAITING_APPROVAL' && <p className="mt-3 text-sm text-muted">Paid. The Hub Coordinator is assigning your doctor and room.</p>}
      {JOINABLE.has(a.status) && !canJoin && opensAt && now < opensAt && (
        <p className="mt-3 text-sm text-muted">The room opens at {formatTime(a.joinWindowOpensAt)} WAT. Find somewhere private before then.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {canJoin && (
          <Link to={`/portal/consultations/${encodeURIComponent(a.publicId)}`} className="btn btn-primary no-underline">
            <i aria-hidden className="bi bi-camera-video" /> Join the consultation
          </Link>
        )}
        {held && (
          <Link to="/portal/booking" className="btn btn-primary no-underline">
            Finish booking
          </Link>
        )}
        <button type="button" className="btn btn-quiet btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide history' : 'Show history'}
        </button>
      </div>
      {open && (
        <div className="mt-4">
          <History id={a.publicId} />
        </div>
      )}
    </li>
  )
}

export function Appointments() {
  const { appointmentId } = useParams()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const mine = useQuery({ queryKey: ['my-appointments'], queryFn: bookingApi.mine, refetchInterval: 60_000 })
  const rows = [...(mine.data ?? [])].sort((x, y) => (parseServerTime(y.appointmentDate)?.getTime() ?? 0) - (parseServerTime(x.appointmentDate)?.getTime() ?? 0))
  return (
    <>
      <PageHeader
        kicker="My care"
        title="Appointments"
        actions={
          <Link to="/portal/booking" className="btn btn-primary no-underline">
            Book a consultation
          </Link>
        }
      />
      {notice && <Alert tone="info" className="mb-5">{notice}</Alert>}
      {mine.isLoading && <Spinner label="Loading appointments" />}
      {mine.isError && <ErrorState error={mine.error} onRetry={() => mine.refetch()} />}
      {mine.data?.length === 0 && (
        <div className="card">
          <EmptyState icon="bi-calendar2" title="No appointments yet">
            Book a follow-up consultation when your clinical team has approved remote care.
          </EmptyState>
        </div>
      )}
      <ul className="space-y-4">
        {rows.map((a) => (
          <Card key={a.publicId} a={a} highlighted={a.publicId === appointmentId} />
        ))}
      </ul>
    </>
  )
}
