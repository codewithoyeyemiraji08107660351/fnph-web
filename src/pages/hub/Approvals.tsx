import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { approvalsApi } from '@/lib/api/endpoints/hub'
import { lifecycleApi } from '@/lib/api/endpoints/records'
import type { Appointment, MissedAppointment } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, formatRelative, humanise, parseServerTime } from '@/lib/format'
import { useNow } from '@/lib/hooks/useNow'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { ApproveDialog } from './ApproveDialog'
import { RescheduleDialog } from './RescheduleDialog'

/** How far back the missed list looks. */
const MISSED_DAYS = 30

const hasPassed = (iso: string, now: number) => (parseServerTime(iso)?.getTime() ?? 0) <= now

/**
  Missed consultations (the patient did not attend) from the last 30 days
  that have not been given a new time. Booking one creates a new request in
  the queue above, already paid for.
*/
function MissedPanel({ onRebook }: { onRebook: (m: MissedAppointment) => void }) {
  const missed = useQuery({ queryKey: ['approvals-missed'], queryFn: () => approvalsApi.missed(MISSED_DAYS), refetchInterval: 120_000 })
  return (
    <Panel className="mt-6" title="Missed consultations" bodyClassName="">
      <p className="border-b border-line px-5 py-3 text-sm text-muted">
        Patients who did not attend in the last {MISSED_DAYS} days. Book a new time to give them another consultation without paying again.
      </p>
      {missed.isLoading && <div className="p-5"><Spinner label="Loading missed consultations" /></div>}
      {missed.isError && <ErrorState error={missed.error} onRetry={() => missed.refetch()} />}
      {missed.data?.length === 0 && <EmptyState icon="bi-calendar-check" title="No missed consultations">Every patient in the last {MISSED_DAYS} days attended or has a new time.</EmptyState>}
      {!!missed.data?.length && (
        <ul className="divide-y divide-line">
          {missed.data.map((m) => (
            <li key={m.publicId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="font-display font-extrabold">{m.patientName} <span className="text-sm font-semibold text-muted">EHR {m.ehrNumber}</span></p>
                <p className="text-sm text-muted">
                  {m.reference}. Missed {formatDateTime(m.appointmentDate)} WAT{m.doctorName ? ` with ${m.doctorName}` : ''}.
                </p>
                {m.noShowReason && <p className="text-sm text-muted">Note: {m.noShowReason}</p>}
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onRebook(m)}>
                <i aria-hidden className="bi bi-calendar-plus" /> Book new time
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function HistoryDialog({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const history = useQuery({ queryKey: ['approval-history', appointment.publicId], queryFn: () => approvalsApi.history(appointment.publicId) })
  return (
    <Dialog open onClose={onClose} title={`History of ${appointment.reference}`}>
      {history.isLoading && <Spinner label="Loading" />}
      {history.isError && <ErrorState error={history.error} />}
      <ol className="space-y-3 border-l-2 border-line pl-4">
        {history.data?.map((h, i) => (
          <li key={i} className="text-sm">
            <p className="font-bold">{humanise(h.toStatus)}</p>
            <p className="text-xs text-muted">{formatDateTime(h.changedAt)} {h.changedBy && `by ${h.changedBy}`}</p>
            {h.reason && <p className="text-muted">{h.reason}</p>}
          </li>
        ))}
      </ol>
    </Dialog>
  )
}

export function Approvals() {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()
  const now = useNow(60_000)
  const queue = useQuery({ queryKey: ['approvals'], queryFn: () => approvalsApi.queue(), refetchInterval: 60_000 })
  const [approving, setApproving] = useState<Appointment | null>(null)
  const [rejecting, setRejecting] = useState<Appointment | null>(null)
  const [history, setHistory] = useState<Appointment | null>(null)
  const [moving, setMoving] = useState<Appointment | null>(null)
  const [rebooking, setRebooking] = useState<MissedAppointment | null>(null)

  const refresh = () =>
    Promise.all([qc.invalidateQueries({ queryKey: ['approvals'] }), qc.invalidateQueries({ queryKey: ['approvals-missed'] })])
  const close = () => {
    if (appointmentId) navigate('/hub/approvals', { replace: true })
  }

  return (
    <>
      <PageHeader
        kicker="Hub coordination"
        title="Awaiting approval"
        description="Paid requests, earliest first. Approve with a doctor, a room and the care team, reschedule to another time, or reject with a reason the patient will see."
        actions={<button type="button" className="btn btn-secondary" onClick={() => void refresh()}><i aria-hidden className="bi bi-arrow-clockwise" /> Reload</button>}
      />
      <Panel bodyClassName="">
        {queue.isLoading && <div className="p-5"><Spinner label="Loading the queue" /></div>}
        {queue.isError && <ErrorState error={queue.error} onRetry={() => queue.refetch()} />}
        {queue.data?.appointments.length === 0 && <EmptyState icon="bi-inbox" title="Nothing waiting">Paid requests appear here as soon as payment is confirmed.</EmptyState>}
        {!!queue.data?.appointments.length && (
          <>
            <p className="border-b border-line px-5 py-3 text-sm text-muted">{queue.data.total} waiting</p>
            <ul className="divide-y divide-line">
              {queue.data.appointments.map((a) => {
                const overdue = hasPassed(a.appointmentDate, now)
                return (
                  <li key={a.publicId} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${a.publicId === appointmentId ? 'bg-accent-soft/60' : ''}`}>
                    <div>
                      <p className="font-display font-extrabold">{formatDateTime(a.appointmentDate)} WAT</p>
                      {overdue ? (
                        <p className="text-sm text-alarm-700">
                          <i aria-hidden className="bi bi-exclamation-triangle-fill mr-1" />
                          {a.reference}. This time passed before approval. Reschedule it to approve.
                        </p>
                      ) : (
                        <p className="text-sm text-muted">{a.reference}. Requested time starts {formatRelative(a.appointmentDate)}.</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => setHistory(a)}>History</button>
                      {can('appointment.reject') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRejecting(a)}>Reject</button>}
                      {can('appointment.reschedule') && (
                        <button type="button" className={`btn btn-sm ${overdue ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMoving(a)}>
                          <i aria-hidden className="bi bi-calendar-event" /> Reschedule
                        </button>
                      )}
                      {can('appointment.approve') && !overdue && <button type="button" className="btn btn-primary btn-sm" onClick={() => setApproving(a)}>Approve</button>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Panel>

      {can('appointment.approve') && <MissedPanel onRebook={setRebooking} />}

      {approving && (
        <ApproveDialog
          appointment={approving}
          onClose={() => {
            setApproving(null)
            close()
            void refresh()
          }}
          onDone={() => {
            toast(`${approving.reference} approved. The team has been notified.`)
            setApproving(null)
            close()
            void refresh()
          }}
        />
      )}
      {rejecting && (
        <ReasonDialog
          title={`Reject ${rejecting.reference}`}
          description="The patient is shown this reason, and their payment stays on their account as credit. Write it for them."
          label="Reason the patient will see"
          placeholder="No doctor is available at this time. Please choose another day."
          confirmLabel="Reject request"
          danger
          onClose={() => setRejecting(null)}
          onConfirm={async (reason) => {
            await approvalsApi.reject(rejecting.publicId, reason)
            toast(`${rejecting.reference} rejected. The patient has been told.`)
            setRejecting(null)
            close()
            await refresh()
          }}
        />
      )}
      {history && <HistoryDialog appointment={history} onClose={() => setHistory(null)} />}
      {moving && (
        <RescheduleDialog
          mode="move"
          target={moving}
          onClose={() => setMoving(null)}
          onSubmit={async (slot, reason) => {
            const moved = await lifecycleApi.reschedule(moving.publicId, slot, reason)
            toast(`${moving.reference} moved to ${formatDateTime(moved.newTime)} WAT. It is still awaiting approval and the patient has been told.`)
            setMoving(null)
            close()
            await refresh()
          }}
        />
      )}
      {rebooking && (
        <RescheduleDialog
          mode="rebook"
          target={rebooking}
          onClose={() => setRebooking(null)}
          onSubmit={async (slot, reason) => {
            const created = await approvalsApi.rebook(rebooking.publicId, slot, reason)
            toast(`${rebooking.patientName} rebooked as ${created.reference} for ${formatDateTime(created.appointmentDate)} WAT. Approve it above when ready.`)
            setRebooking(null)
            await refresh()
          }}
        />
      )}
    </>
  )
}
