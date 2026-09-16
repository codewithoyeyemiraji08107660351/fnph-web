import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { bookingApi } from '@/lib/api/endpoints/patient'
import { lifecycleApi } from '@/lib/api/endpoints/records'
import { toApiError } from '@/lib/api/http'
import { useQueryClient } from '@tanstack/react-query'
import { DISPLAY_TIME_ZONE } from '@/lib/format'
import { Dialog } from '@/components/ui/Dialog'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { UploadDialog } from '@/features/files/UploadDialog'
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

const watDay = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE }).format(new Date(Date.now() + offset * 86_400_000))

function MoveDialog({ a, onClose, onDone }: { a: Appointment; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(watDay(1))
  const [slot, setSlot] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const times = useQuery({ queryKey: ['booking-times', date], queryFn: () => bookingApi.times(date) })
  return (
    <Dialog open onClose={onClose} busy={busy} title="Move to another time"
      description="Your appointment moves straight away. The hospital then confirms a doctor and room again, and your payment carries over."
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Keep my time</button>
        <button type="button" className="btn btn-primary" disabled={busy || !slot || reason.trim().length < 5} onClick={async () => {
          setBusy(true); setError(null)
          try { await lifecycleApi.reschedule(a.publicId, slot!, reason.trim()); onDone() } catch (err) { setError(toApiError(err).message); setBusy(false); void times.refetch() }
        }}>{busy ? <Spinner label="Moving" inverted /> : 'Move my appointment'}</button></>}>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <TextField label="New day" type="date" min={watDay(0)} value={date} onChange={(e) => { setDate(e.target.value); setSlot(null) }} />
      {times.isLoading && <Spinner className="mt-3" />}
      {times.data?.length === 0 && <p className="mt-3 text-sm text-muted">No times left on this day.</p>}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {times.data?.map((t) => (
          <button key={t.slotPublicId} type="button" aria-pressed={slot === t.slotPublicId} onClick={() => setSlot(t.slotPublicId)}
            className={`rounded-[12px] border px-2 py-2 font-display font-extrabold ${slot === t.slotPublicId ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-white'}`}>
            {formatTime(t.startAt)}
          </button>
        ))}
      </div>
      <TextField wrapperClassName="mt-4" label="Why are you moving it?" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="I have to travel that day" />
    </Dialog>
  )
}

function Card({ a, highlighted }: { a: Appointment; highlighted: boolean }) {
  const now = useNow(15_000)
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(highlighted)
  const [action, setAction] = useState<'cancel' | 'move' | 'attach' | null>(null)
  const changeable = (a.status === 'APPROVED' || a.status === 'AWAITING_APPROVAL') && (parseServerTime(a.appointmentDate)?.getTime() ?? 0) > now
  const refresh = () => void qc.invalidateQueries({ queryKey: ['my-appointments'] })
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
        {changeable && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction('move')}>Move</button>}
        {changeable && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction('cancel')}>Ask to cancel</button>}
        {changeable && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAction('attach')}><i aria-hidden className="bi bi-paperclip" /> Attach a result</button>}
        <button type="button" className="btn btn-quiet btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide history' : 'Show history'}
        </button>
      </div>
      {action === 'move' && <MoveDialog a={a} onClose={() => setAction(null)} onDone={() => { setAction(null); toast('Moved. The hospital will confirm the new time.'); refresh() }} />}
      {action === 'attach' && (
        <UploadDialog title="Attach a result for this appointment" referenceId={a.publicId} categories={['LABORATORY_RESULT', 'VITALS_EVIDENCE', 'SUPPORTING_DOCUMENT']}
          onClose={() => setAction(null)} onDone={() => { setAction(null); toast('Attached. The care team can see it.') }} />
      )}
      {action === 'cancel' && (
        <ReasonDialog title="Ask to cancel this appointment" confirmLabel="Send request" label="Why do you need to cancel?" min={5}
          description="The hospital decides. If it is cancelled, the amount you paid stays on your account for your next booking."
          onClose={() => setAction(null)}
          onConfirm={async (reason) => {
            const r = await lifecycleApi.requestChange(a.publicId, { requestType: 'CANCEL', reason })
            toast(r.withinNoticePeriod ? 'Request sent. You will be told the decision.' : `Request sent. This is less than ${r.requiredNoticeHours} hours before the appointment, so it may not be accepted.`, r.withinNoticePeriod ? 'success' : 'info')
            setAction(null)
          }} />
      )}
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
