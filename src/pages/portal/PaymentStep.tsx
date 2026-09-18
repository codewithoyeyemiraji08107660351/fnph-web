import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { bookingApi, paymentApi } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import type { Appointment, PaymentView } from '@/lib/api/types'
import { formatDateTime, formatNaira, parseServerTime } from '@/lib/format'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { Panel } from '@/components/ui/Page'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

const AUTO_CHECK_MS = 30_000
const AUTO_CHECK_LIMIT = 20

/** An unexpired payment the patient can still complete, so a refresh never issues a second RRR. */
function resumable(payments: PaymentView[]): PaymentView | undefined {
  const now = Date.now()
  return payments.find(
    (p) =>
      !p.usedForBooking &&
      (p.status === 'SUCCESS' || (p.status === 'PENDING' && (parseServerTime(p.expiresAt)?.getTime() ?? now + 1) > now)),
  )
}

function Breakdown({ payment }: { payment: PaymentView }) {
  const credit = Number(payment.creditApplied)
  return (
    <dl className="divide-y divide-line rounded-[14px] border border-line text-sm">
      <div className="flex justify-between px-4 py-2.5">
        <dt className="text-muted">Consultation fee</dt>
        <dd>{formatNaira(payment.amount)}</dd>
      </div>
      {credit > 0 && (
        <div className="flex justify-between px-4 py-2.5">
          <dt className="text-muted">Credit on your account</dt>
          <dd className="text-forest">-{formatNaira(credit)}</dd>
        </div>
      )}
      <div className="flex justify-between px-4 py-3 text-base">
        <dt className="font-bold">To pay</dt>
        <dd className="font-display font-extrabold">{formatNaira(payment.payableAmount)}</dd>
      </div>
    </dl>
  )
}

export function PaymentStep({ appointment, onPaid }: { appointment?: Appointment; onPaid?: (payment: PaymentView) => void }) {
  const qc = useQueryClient()
  const { helpdeskEmail } = usePublicSettings()
  const history = useQuery({ queryKey: ['my-payments'], queryFn: paymentApi.mine })
  const credit = useQuery({ queryKey: ['my-credit'], queryFn: paymentApi.credit })
  const [payment, setPayment] = useState<PaymentView | null>(null)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const checks = useRef(0)

  useEffect(() => {
    if (payment || !history.data) return
    const existing = resumable(history.data)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (existing) setPayment(existing)
  }, [history.data, payment])

  // Once money is confirmed, the booking moves to the hospital's desk shortly after.
  const paid = payment?.status === 'SUCCESS'
  const booking = useQuery({
    queryKey: ['my-appointments', 'confirming'],
    queryFn: bookingApi.mine,
    enabled: paid && !confirmed && !!appointment,
    refetchInterval: 4000,
  })
  useEffect(() => {
    const current = booking.data?.find((a) => a.publicId === appointment?.publicId)
    if (current && current.status !== 'SLOT_HELD' && current.status !== 'EXPIRED') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmed(true)
      sessionStorage.removeItem('fnph.booking.vitalsFor')
      void qc.invalidateQueries({ queryKey: ['my-appointments'] })
    }
  }, [booking.data, appointment?.publicId, qc])

  const check = async (silent = false) => {
    if (!payment) return
    if (!silent) {
      setChecking(true)
      setError(null)
    }
    try {
      setPayment(await paymentApi.verify(payment.reference))
    } catch (err) {
      if (!silent) setError(toApiError(err).message)
    } finally {
      if (!silent) setChecking(false)
    }
  }

  // Gentle automatic checks while the patient pays elsewhere.
  useEffect(() => {
    if (payment?.status !== 'PENDING' || !payment.rrr) return
    const t = window.setInterval(() => {
      if (checks.current >= AUTO_CHECK_LIMIT || document.hidden) return
      checks.current += 1
      void check(true)
    }, AUTO_CHECK_MS)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.status, payment?.reference, payment?.rrr])

  const start = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setPayment(await paymentApi.initiate({}))
      void qc.invalidateQueries({ queryKey: ['my-payments'] })
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  if (confirmed && appointment) {
    return (
      <Panel>
        <span className="grid size-12 place-items-center rounded-2xl bg-mint text-xl text-forest">
          <i aria-hidden className="bi bi-check2-circle" />
        </span>
        <h2 className="mt-4 text-2xl font-extrabold">Your request is with the hospital</h2>
        <p className="mt-2 text-sm text-muted">
          Payment confirmed and your time, {formatDateTime(appointment.appointmentDate)} WAT, is reserved. The Hub Coordinator confirms the doctor and room, and you will be notified.
          Reference <strong className="text-ink">{appointment.reference}</strong>.
        </p>
        {payment?.amountMismatch && <Alert tone="info" className="mt-4">You paid more than was due. The difference is on your account as credit for a future booking.</Alert>}
        <Link to="/portal/appointments" className="btn btn-primary mt-5 no-underline">
          See my appointments
        </Link>
      </Panel>
    )
  }

  if (history.isLoading) return <Spinner label="Checking your payments" />

  return (
    <><div className="screen-heading"><span className="eyebrow">Payment confirmation</span><h1>Complete the consultation fee</h1><p>The booking calendar unlocks only when Remita confirms a successful ₦10,000 payment through secure server verification. No card or bank details are collected on this page.</p></div>
    <div className="payment-layout"><div className="card payment-card"><span className="payment-mark">R</span><h2>FNPH Kaduna telepsychiatry</h2>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {!payment ? <form onSubmit={start} noValidate>
          {credit.data && Number(credit.data.balance) > 0 && (
            <Alert tone="success" className="mb-4">You have {formatNaira(credit.data.balance)} in credit. It is used automatically.</Alert>
          )}
          <div className="payment-total"><span>Consultation fee</span><strong>₦10,000</strong></div><p>Continue through the approved Remita card, transfer or bank-payment options. A webhook and backend status check verify success before date selection is enabled.</p>
          <button type="submit" className="button primary full" disabled={busy}>{busy ? <Spinner label="Starting" inverted /> : 'Get my Remita payment reference'}</button><small>No payment-card or bank-login information is entered in this portal.</small>
        </form> : paid ? (
        <div className="space-y-4">
          <Breakdown payment={payment} />
          <div className="flex items-center gap-3 rounded-[14px] bg-mint px-4 py-3 text-sm text-forest-900">
            Payment verified by the server. You can now choose a published date and time.
          </div>
          {onPaid && <button className="button primary full" onClick={() => onPaid(payment)}>Choose a date and time →</button>}
        </div>
      ) : payment.status === 'PENDING' ? (
        <div className="space-y-5">
          <Breakdown payment={payment} />
          {payment.rrr && (
            <div className="rounded-[16px] border-2 border-dashed border-accent p-5 text-center">
              <p className="text-xs font-bold tracking-wide text-muted uppercase">Your RRR</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-widest select-all">{payment.rrr}</p>
              <button type="button" className="btn btn-quiet btn-sm mt-2" onClick={() => navigator.clipboard?.writeText(payment.rrr ?? '')}>
                <i aria-hidden className="bi bi-clipboard" /> Copy
              </button>
            </div>
          )}
          <div className="text-sm">
            <p className="font-bold">How to pay</p>
            <p className="mt-1 text-muted">
              Pay {formatNaira(payment.payableAmount)} against this RRR through your bank app, internet banking, at any bank branch, or on the Remita website. Keep the receipt. The
              reference is valid until {formatDateTime(payment.expiresAt)} WAT. Calendar selection opens after payment is verified.
            </p>
          </div>
          <button type="button" className="button primary full" disabled={checking} onClick={() => check()}>
            {checking ? <Spinner label="Asking Remita" inverted /> : 'I have paid, check now'}
          </button>
          <p className="text-xs text-muted">We also check every half minute while this page is open. Only a confirmation from Remita counts, so returning to this page is not enough on its own.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert tone="danger" title="This payment did not go through">
            {payment.failureReason ?? 'Remita did not confirm it.'} If money left your account, contact <a href={`mailto:${helpdeskEmail}`}>{helpdeskEmail}</a> with reference {payment.reference}.
          </Alert>
          <button type="button" className="button primary" onClick={() => setPayment(null)}>
            Start the payment again
          </button>
        </div>
      )}</div><aside className="card side-checklist"><h2>Ready for booking</h2><p>Completed before payment:</p><ul><li>First-time agreement and signature</li><li>Non-emergency safety triage</li><li>Consultation reason</li><li>Recent vital signs</li><li>Optional laboratory information</li></ul></aside></div></>
  )
}
