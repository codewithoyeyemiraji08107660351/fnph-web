import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { bookingApi, carePathApi } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import type { Appointment, AvailableTime, TriageResult } from '@/lib/api/types'
import { DISPLAY_TIME_ZONE, formatDateTime, formatLongDate, formatPhone, formatTime, parseServerTime } from '@/lib/format'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { useCountdown } from '@/lib/hooks/useCountdown'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { VitalsForm } from './VitalsForm'
import { PaymentStep } from './PaymentStep'

type Step = 'consent' | 'triage' | 'time' | 'vitals' | 'pay'

const STEPS: Array<{ key: Step; label: string }> = [
  { key: 'consent', label: 'Consent' },
  { key: 'triage', label: 'Safety questions' },
  { key: 'time', label: 'Choose a time' },
  { key: 'vitals', label: 'Vital signs' },
  { key: 'pay', label: 'Payment' },
]

// Per tab, so a shared computer does not carry one patient's progress to the next.
const CONSENTED = 'fnph.booking.consented'
const STOPPED = 'fnph.booking.stopped'
const VITALS_FOR = 'fnph.booking.vitalsFor'

function todayWat(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE }).format(d)
}

function Stepper({ current }: { current: Step }) {
  const index = STEPS.findIndex((s) => s.key === current)
  return (
    <ol className="mb-6 flex gap-1.5 overflow-x-auto pb-1" aria-label="Booking progress">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={i === index ? 'step' : undefined}>
          <span className={`h-1.5 rounded-full ${i <= index ? 'bg-accent' : 'bg-line'}`} />
          <span className={`truncate text-[0.7rem] font-bold ${i === index ? 'text-ink' : 'text-muted'}`}>
            {i + 1}. {s.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

function StopScreen({ result }: { result: Pick<TriageResult, 'escalation' | 'stopReason'> }) {
  const { emergencyNumber } = usePublicSettings()
  // No booking link, no retry, nothing that leads to the calendar. A person who
  // has just said they are in crisis needs a number to call.
  return (
    <div className="rounded-[22px] border border-[#e9c3c0] bg-blush p-6 sm:p-8" role="alert">
      <span className="grid size-12 place-items-center rounded-2xl bg-alarm text-xl text-white">
        <i aria-hidden className="bi bi-telephone-fill" />
      </span>
      <h2 className="mt-4 text-2xl font-extrabold text-alarm-700">Please get help now</h2>
      <p className="mt-2 text-alarm-700">A video appointment is not the right care for what you have told us. Someone needs to see you today.</p>
      <a href={`tel:${emergencyNumber}`} className="btn btn-danger mt-5 w-full text-base no-underline sm:w-auto">
        Call {formatPhone(emergencyNumber)}
      </a>
      <p className="mt-3 text-sm text-alarm-700">Or go to the nearest hospital emergency department now.</p>
      {result.escalation && <p className="mt-5 text-sm whitespace-pre-line text-ink">{result.escalation}</p>}
    </div>
  )
}

function ConsentStep({ onDone }: { onDone: () => void }) {
  const consent = useQuery({ queryKey: ['consent'], queryFn: carePathApi.consent })
  const [read, setRead] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (consent.isLoading) return <Spinner label="Loading the consent document" />
  if (consent.isError) return <ErrorState error={consent.error} onRetry={() => consent.refetch()} />
  const doc = consent.data!
  return (
    <Panel title={doc.title} action={<span className="text-xs text-muted">Version {doc.version}</span>}>
      <div className="max-h-[50vh] overflow-y-auto rounded-[14px] border border-line bg-canvas p-4 text-sm leading-relaxed whitespace-pre-line">{doc.body}</div>
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      <label className="mt-5 flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={read} onChange={(e) => setRead(e.target.checked)} />
        <span>I have read this and I agree to a telepsychiatry consultation on these terms.</span>
      </label>
      <button
        type="button"
        className="btn btn-primary mt-5"
        disabled={!read || busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await carePathApi.acceptConsent()
            sessionStorage.setItem(CONSENTED, doc.version)
            onDone()
          } catch (err) {
            setError(toApiError(err).message)
            setBusy(false)
          }
        }}
      >
        {busy ? <Spinner label="Recording" inverted /> : 'I agree, continue'}
      </button>
    </Panel>
  )
}

function TriageStep({ onProceed, onStop }: { onProceed: () => void; onStop: (r: TriageResult) => void }) {
  const set = useQuery({ queryKey: ['triage-questions'], queryFn: carePathApi.questions })
  const [answers, setAnswers] = useState<Record<string, 'YES' | 'NO'>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const questions = useMemo(() => [...(set.data?.questions ?? [])].sort((a, b) => a.sequence - b.sequence), [set.data])
  if (set.isLoading) return <Spinner label="Loading the questions" />
  if (set.isError) return <ErrorState error={set.error} onRetry={() => set.refetch()} />
  const complete = questions.length > 0 && questions.every((q) => answers[q.publicId])
  return (
    <Panel title="A few questions before you book">
      <p className="text-sm text-muted">These check that a video consultation is safe for you right now. Answer honestly. There is no wrong answer.</p>
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      <ol className="mt-5 space-y-4">
        {questions.map((q, i) => (
          <li key={q.publicId}>
            <fieldset className="rounded-[14px] border border-line p-4">
              <legend className="px-1 text-sm font-bold">
                {i + 1}. {q.questionText}
              </legend>
              <div className="mt-2 flex gap-3">
                {(['YES', 'NO'] as const).map((v) => (
                  <label key={v} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] border text-sm font-bold ${answers[q.publicId] === v ? 'border-accent bg-accent-soft text-accent' : 'border-line'}`}>
                    <input type="radio" className="sr-only" name={q.publicId} checked={answers[q.publicId] === v} onChange={() => setAnswers((a) => ({ ...a, [q.publicId]: v }))} />
                    {v === 'YES' ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="btn btn-primary mt-5"
        disabled={!complete || busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            const result = await carePathApi.submitTriage(answers)
            if (result.mayProceed) onProceed()
            else onStop(result)
          } catch (err) {
            setError(toApiError(err).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? <Spinner label="Checking" inverted /> : 'Continue'}
      </button>
    </Panel>
  )
}

function TimeStep({ onHeld, notice }: { onHeld: (a: Appointment) => void; notice?: string | null }) {
  const [date, setDate] = useState(todayWat())
  const [error, setError] = useState<string | null>(notice ?? null)
  const [busy, setBusy] = useState<string | null>(null)
  const times = useQuery({ queryKey: ['booking-times', date], queryFn: () => bookingApi.times(date) })
  const days = Array.from({ length: 14 }, (_, i) => todayWat(i))

  const take = async (t: AvailableTime) => {
    setBusy(t.slotPublicId)
    setError(null)
    try {
      onHeld(await bookingApi.hold(t.slotPublicId))
    } catch (err) {
      const e = toApiError(err)
      setError(e.message)
      if (e.status === 409) void times.refetch()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel title="Choose a time" action={<span className="text-xs text-muted">Times are WAT</span>}>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="listbox" aria-label="Day">
        {days.map((d) => {
          const dt = new Date(`${d}T12:00:00+01:00`)
          const active = d === date
          return (
            <button
              key={d}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => setDate(d)}
              className={`flex min-w-[64px] flex-col items-center rounded-[14px] border px-3 py-2 ${active ? 'border-accent bg-accent text-white' : 'border-line bg-white hover:border-accent'}`}
            >
              <span className="text-[0.68rem] font-bold uppercase">{new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: DISPLAY_TIME_ZONE }).format(dt)}</span>
              <span className="font-display text-lg font-extrabold">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: DISPLAY_TIME_ZONE }).format(dt)}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-sm font-bold">{formatLongDate(new Date(`${date}T12:00:00+01:00`))}</p>
      {error && <Alert tone="warning" className="mt-3">{error}</Alert>}
      {times.isLoading && <Spinner label="Finding times" className="mt-4" />}
      {times.isError && <ErrorState error={times.error} onRetry={() => times.refetch()} />}
      {times.data?.length === 0 && <p className="mt-4 rounded-[14px] bg-canvas p-4 text-sm text-muted">No times left on this day. Try another day.</p>}
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {times.data?.map((t) => (
          <li key={t.slotPublicId}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => take(t)}
              className="flex w-full flex-col items-center rounded-[14px] border border-line bg-white px-3 py-3 hover:border-accent disabled:opacity-50"
            >
              <span className="font-display text-lg font-extrabold">{busy === t.slotPublicId ? <Spinner /> : formatTime(t.startAt)}</span>
              <span className="text-[0.7rem] text-muted">{t.remaining === 1 ? 'Last one at this time' : `to ${formatTime(t.endAt)}`}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">Choosing a time holds it for a short while so you can add your readings and pay. If payment is not finished, the time is released.</p>
    </Panel>
  )
}

function HoldBanner({ appointment }: { appointment: Appointment }) {
  const hold = useCountdown(appointment.heldUntil)
  const urgent = hold.ms > 0 && hold.ms < 3 * 60_000
  return (
    <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] px-4 py-3 ${urgent ? 'bg-blush text-alarm-700' : 'bg-accent-soft text-accent-strong'}`} aria-live="polite">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide">Your time is held</p>
        <p className="font-display text-lg font-extrabold">{formatDateTime(appointment.appointmentDate)} WAT</p>
      </div>
      <div className="text-right">
        <p className="text-xs">Held for</p>
        <p className="font-display text-2xl font-extrabold tabular-nums">{hold.label}</p>
      </div>
    </div>
  )
}

export function BookingFlow() {
  const qc = useQueryClient()
  const mine = useQuery({ queryKey: ['my-appointments'], queryFn: bookingApi.mine })
  const [step, setStep] = useState<Step | null>(null)
  const [held, setHeld] = useState<Appointment | null>(null)
  const [stopped, setStopped] = useState<Pick<TriageResult, 'escalation' | 'stopReason'> | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STOPPED) ?? 'null')
    } catch {
      return null
    }
  })
  const [timeNotice, setTimeNotice] = useState<string | null>(null)

  // Decide where to start once, from the server's view of any live hold.
  useEffect(() => {
    if (step || !mine.data) return
    const live = mine.data.find((a) => a.status === 'SLOT_HELD' && (parseServerTime(a.heldUntil)?.getTime() ?? 0) > Date.now())
    if (live) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHeld(live)
      setStep(sessionStorage.getItem(VITALS_FOR) === live.publicId ? 'pay' : 'vitals')
    } else {
      setStep(sessionStorage.getItem(CONSENTED) ? 'triage' : 'consent')
    }
  }, [mine.data, step])

  const heldExpired = useCountdown(held?.heldUntil).expired

  const restartAfterExpiry = () => {
    setHeld(null)
    setTimeNotice('The hold ran out, so that time was released. Nothing was charged for it. Choose a time again.')
    setStep('time')
    void qc.invalidateQueries({ queryKey: ['my-appointments'] })
  }

  const title = <PageHeader kicker="Existing patients" title="Book a consultation" description="Five short steps. Your answers go to the hospital team that approves your appointment." />

  if (stopped) {
    return (
      <>
        {title}
        <StopScreen result={stopped} />
      </>
    )
  }
  if (mine.isLoading || !step) return <>{title}<Spinner label="Checking your bookings" /></>
  if (mine.isError) return <>{title}<ErrorState error={mine.error} onRetry={() => mine.refetch()} /></>

  const awaiting = mine.data?.find((a) => a.status === 'AWAITING_APPROVAL' || a.status === 'APPROVED')

  return (
    <>
      {title}
      <Stepper current={step} />
      {awaiting && step === 'consent' && (
        <Alert tone="info" className="mb-5" title="You already have a booking">
          {formatDateTime(awaiting.appointmentDate)} WAT. <Link to="/portal/appointments">See your appointments</Link> before booking another.
        </Alert>
      )}
      {held && (step === 'vitals' || step === 'pay') && <HoldBanner appointment={held} />}
      {held && heldExpired && (step === 'vitals' || step === 'pay') ? (
        <Panel>
          <h2 className="text-xl font-extrabold">That time was released</h2>
          <p className="mt-2 text-sm text-muted">The hold ran out before payment was confirmed. If you did pay, the money stays on your account and covers your next booking.</p>
          <button type="button" className="btn btn-primary mt-5" onClick={restartAfterExpiry}>
            Choose another time
          </button>
        </Panel>
      ) : step === 'consent' ? (
        <ConsentStep onDone={() => setStep('triage')} />
      ) : step === 'triage' ? (
        <TriageStep
          onProceed={() => setStep('time')}
          onStop={(r) => {
            const kept = { escalation: r.escalation, stopReason: r.stopReason }
            sessionStorage.setItem(STOPPED, JSON.stringify(kept))
            setStopped(kept)
          }}
        />
      ) : step === 'time' ? (
        <TimeStep
          notice={timeNotice}
          onHeld={(a) => {
            setHeld(a)
            setTimeNotice(null)
            setStep('vitals')
            void qc.invalidateQueries({ queryKey: ['my-appointments'] })
          }}
        />
      ) : step === 'vitals' && held ? (
        <Panel title="Your recent vital signs">
          <p className="mb-5 text-sm text-muted">Take these today if you can. A nurse checks them before your consultation, and the doctor reads them.</p>
          <VitalsForm
            appointmentPublicId={held.publicId}
            onSaved={() => {
              sessionStorage.setItem(VITALS_FOR, held.publicId)
              setStep('pay')
            }}
          />
        </Panel>
      ) : step === 'pay' && held ? (
        <PaymentStep appointment={held} />
      ) : null}
    </>
  )
}
