import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { bookingApi } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import { formatCalendarDate, formatDateTime, formatTime } from '@/lib/format'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

/** How many open days to offer as one-tap choices. */
const DAY_CHOICES = 12
const MIN_REASON = 5

export interface RescheduleTarget {
  reference: string
  appointmentDate: string
  patientName?: string
}

/**
 * Picks a new patient time and a reason, then hands both to `onSubmit`.
 *
 * Used for a request awaiting approval (the same appointment moves) and for
 * a missed consultation (a new appointment is booked). Only open patient
 * times are offered: the list is the one patients book from, so a time
 * shown here can be taken.
 */
export function RescheduleDialog({
  target,
  mode,
  onSubmit,
  onClose,
}: {
  target: RescheduleTarget
  mode: 'move' | 'rebook'
  onSubmit: (slotPublicId: string, reason: string) => Promise<void>
  onClose: () => void
}) {
  const [day, setDay] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const days = useQuery({ queryKey: ['hub-open-days'], queryFn: () => bookingApi.days() })
  const chosenDay = day ?? days.data?.[0] ?? null
  const times = useQuery({
    queryKey: ['booking-times', chosenDay],
    queryFn: () => bookingApi.times(chosenDay as string),
    enabled: Boolean(chosenDay),
  })

  const ready = Boolean(slot) && reason.trim().length >= MIN_REASON
  const submit = async () => {
    if (!slot) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(slot, reason.trim())
    } catch (err) {
      setError(toApiError(err).message)
      setSlot(null)
      setBusy(false)
      void times.refetch()
    }
  }

  const title = mode === 'rebook' ? `Book a new time for ${target.reference}` : `Reschedule ${target.reference}`
  const description =
    mode === 'rebook'
      ? `${target.patientName ? `${target.patientName} missed` : 'Missed'} ${formatDateTime(target.appointmentDate)} WAT. A new appointment is created at the time you choose and waits for your approval. Nothing more is charged.`
      : `Currently ${formatDateTime(target.appointmentDate)} WAT. The request moves to the new time and stays awaiting approval. The patient is told. Nothing more is charged.`

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      size="lg"
      title={title}
      description={description}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !ready} onClick={() => void submit()}>
            {busy ? <Spinner label="Saving" inverted /> : mode === 'rebook' ? 'Book new time' : 'Move to new time'}
          </button>
        </>
      }
    >
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <p className="text-sm font-bold">Day</p>
      {days.isLoading && <Spinner className="mt-2" label="Loading open days" />}
      {days.isError && <p className="mt-2 text-sm text-alarm">{toApiError(days.error).message}</p>}
      {days.data?.length === 0 && (
        <p className="mt-2 text-sm text-muted">No open patient days. Publish a consultation day under Schedules first.</p>
      )}
      {!!days.data?.length && (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Open days">
          {days.data.slice(0, DAY_CHOICES).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={chosenDay === d}
              onClick={() => {
                setDay(d)
                setSlot(null)
              }}
              className={`rounded-[12px] border px-3 py-2 text-sm font-bold ${chosenDay === d ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-white'}`}
            >
              {formatCalendarDate(d)}
            </button>
          ))}
        </div>
      )}

      {chosenDay && (
        <>
          <p className="mt-5 text-sm font-bold">Time on {formatCalendarDate(chosenDay)} (WAT)</p>
          {times.isLoading && <Spinner className="mt-2" label="Loading times" />}
          {times.isError && <p className="mt-2 text-sm text-alarm">{toApiError(times.error).message}</p>}
          {times.data?.length === 0 && <p className="mt-2 text-sm text-muted">No times left on this day. Choose another.</p>}
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Open times">
            {times.data?.map((t) => (
              <button
                key={t.slotPublicId}
                type="button"
                aria-pressed={slot === t.slotPublicId}
                onClick={() => setSlot(t.slotPublicId)}
                className={`rounded-[12px] border px-2 py-2 font-display font-extrabold ${slot === t.slotPublicId ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-white'}`}
              >
                {formatTime(t.startAt)}
                <span className="block text-[0.7rem] font-semibold text-muted">{t.remaining} free</span>
              </button>
            ))}
          </div>
        </>
      )}

      <TextAreaField
        wrapperClassName="mt-5"
        label={mode === 'rebook' ? 'Why is this patient being rebooked?' : 'Why is it being moved?'}
        hint="Kept on the appointment's history and the audit log."
        rows={3}
        maxLength={400}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={mode === 'rebook' ? 'Patient lost network during the call and asked for another time.' : 'No approval before the requested time; patient agreed a new time by phone.'}
      />
    </Dialog>
  )
}
