import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { paymentApi } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import type { PaymentView } from '@/lib/api/types'
import { formatNaira, parseServerTime } from '@/lib/format'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

const AUTO_CHECK_MS = 30_000
const AUTO_CHECK_LIMIT = 20

/**
 * Finds an existing payment that can still be used.
 *
 * SUCCESS payments are immediately available for booking.
 * PENDING payments are retained so refreshing the page does not
 * create another payment unnecessarily.
 */
function resumable(payments: PaymentView[]): PaymentView | undefined {
  const now = Date.now()

  return payments.find(
    (p) =>
      !p.usedForBooking &&
      (
        p.status === 'SUCCESS' ||
        (
          p.status === 'PENDING' &&
          (parseServerTime(p.expiresAt)?.getTime() ?? now + 1) > now
        )
      ),
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
          <dd className="text-forest">
            -{formatNaira(credit)}
          </dd>
        </div>
      )}

      <div className="flex justify-between px-4 py-3 text-base">
        <dt className="font-bold">To pay</dt>
        <dd className="font-display font-extrabold">
          {formatNaira(payment.payableAmount)}
        </dd>
      </div>
    </dl>
  )
}

export function PaymentStep({
  onPaid,
  onBack,
}: {
  onPaid?: (payment: PaymentView) => void
  onBack?: () => void
}) {
  const qc = useQueryClient()
  const { helpdeskEmail } = usePublicSettings()

  const history = useQuery({
    queryKey: ['my-payments'],
    queryFn: paymentApi.mine,
  })

  const credit = useQuery({
    queryKey: ['my-credit'],
    queryFn: paymentApi.credit,
  })

  const [payment, setPayment] = useState<PaymentView | null>(null)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checks = useRef(0)

  useEffect(() => {
    if (payment || !history.data) return

    const existing = resumable(history.data)

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (existing) {
      setPayment(existing)
    }
  }, [history.data, payment])

  const paid = payment?.status === 'SUCCESS'

  const check = async (silent = false) => {
    if (!payment) return

    if (!silent) {
      setChecking(true)
      setError(null)
    }

    try {
      const verified = await paymentApi.verify(payment.reference)
      setPayment(verified)

      if (verified.status === 'SUCCESS') {
        void qc.invalidateQueries({
          queryKey: ['my-payments'],
        })
      }
    } catch (err) {
      if (!silent) {
        setError(toApiError(err).message)
      }
    } finally {
      if (!silent) {
        setChecking(false)
      }
    }
  }

  /**
   * Automatic status checks are retained only for PENDING payments.
   *
   * In the current TEST MODE, status 00 from the initial charge should
   * already make the payment SUCCESS, so this normally will not run.
   */
  useEffect(() => {
    if (payment?.status !== 'PENDING') return

    const t = window.setInterval(() => {
      if (
        checks.current >= AUTO_CHECK_LIMIT ||
        document.hidden
      ) {
        return
      }

      checks.current += 1
      void check(true)
    }, AUTO_CHECK_MS)

    return () => window.clearInterval(t)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.status, payment?.reference])

  const start = async (e: FormEvent) => {
    e.preventDefault()

    setBusy(true)
    setError(null)

    try {
      const created = await paymentApi.initiate({})

      setPayment(created)

      void qc.invalidateQueries({
        queryKey: ['my-payments'],
      })

      /**
       * TEST MODE:
       * Connect Gateway status 00 is accepted by the backend as SUCCESS.
       */
      if (created.status === 'SUCCESS') {
        return
      }
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  const openPaymentLink = () => {
    if (!payment?.paymentLink) {
      setError('No payment link was returned by the payment service.')
      return
    }

    window.location.assign(payment.paymentLink)
  }

  if (history.isLoading) {
    return <Spinner label="Checking your payments" />
  }

  return (
    <>
      <div className="screen-heading">
        <span className="eyebrow">
          Payment confirmation
        </span>

        <h1>
          Complete the consultation fee
        </h1>

        <p>
          The booking calendar unlocks after your ₦10,000
          consultation payment has been accepted by the
          payment service.
        </p>
      </div>

      {onBack && (
        <button
          type="button"
          className="button secondary mb-4"
          onClick={onBack}
        >
          ← Back to consultation details and vital signs
        </button>
      )}

      <div className="payment-layout">
        <div className="card payment-card">
          <span className="payment-mark">R</span>

          <h2>
            FNPH Kaduna telepsychiatry
          </h2>

          {error && (
            <Alert tone="danger" className="mb-4">
              {error}
            </Alert>
          )}

          {!payment ? (
            <form onSubmit={start} noValidate>
              {credit.data &&
                Number(credit.data.balance) > 0 && (
                  <Alert tone="success" className="mb-4">
                    You have{' '}
                    {formatNaira(credit.data.balance)}{' '}
                    in credit. It is used automatically.
                  </Alert>
                )}

              <div className="payment-total">
                <span>Consultation fee</span>
                <strong>₦10,000</strong>
              </div>

              <p>
                Continue to start your secure payment.
                Payment confirmation is handled by the
                FNPH server.
              </p>

              <button
                type="submit"
                className="button primary full"
                disabled={busy}
              >
                {busy ? (
                  <Spinner
                    label="Starting payment"
                    inverted
                  />
                ) : (
                  'Continue to payment'
                )}
              </button>

              <small>
                No payment-card or bank-login information
                is entered in this portal.
              </small>
            </form>
          ) : paid ? (
            <div className="space-y-4">
              <Breakdown payment={payment} />

              <div className="flex items-center gap-3 rounded-[14px] bg-mint px-4 py-3 text-sm text-forest-900">
                Payment confirmed. You can now choose a
                published consultation date and time.
              </div>

              <button
                className="button primary full"
                onClick={() => onPaid?.(payment)}
              >
                Choose a date and time →
              </button>
            </div>
          ) : payment.status === 'PENDING' ? (
            <div className="space-y-5">
              <Breakdown payment={payment} />

              <div className="rounded-[16px] border border-line p-5">
                <p className="text-sm font-bold">
                  Payment is being processed
                </p>

                <p className="mt-2 text-sm text-muted">
                  Your payment has been created, but the
                  server has not yet received confirmation.
                </p>

                {payment.paymentLink && (
                  <button
                    type="button"
                    className="button primary full mt-4"
                    onClick={openPaymentLink}
                  >
                    Continue to secure payment
                  </button>
                )}
              </div>

              <button
                type="button"
                className="button secondary full"
                disabled={checking}
                onClick={() => check()}
              >
                {checking ? (
                  <Spinner
                    label="Checking payment"
                    inverted
                  />
                ) : (
                  'Check payment status'
                )}
              </button>

              <p className="text-xs text-muted">
                We periodically check the payment status while
                this page remains open.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert
                tone="danger"
                title="This payment did not go through"
              >
                {payment.failureReason ??
                  'The payment service did not confirm the payment.'}{' '}
                If money left your account, contact{' '}
                <a href={`mailto:${helpdeskEmail}`}>
                  {helpdeskEmail}
                </a>{' '}
                with reference {payment.reference}.
              </Alert>

              <button
                type="button"
                className="button primary"
                onClick={() => setPayment(null)}
              >
                Start the payment again
              </button>
            </div>
          )}
        </div>

        <aside className="card side-checklist">
          <h2>Ready for booking</h2>

          <p>
            Completed before payment:
          </p>

          <ul>
            <li>First-time agreement and signature</li>
            <li>Non-emergency safety triage</li>
            <li>Consultation reason</li>
            <li>Recent vital signs</li>
            <li>Optional laboratory information</li>
          </ul>
        </aside>
      </div>
    </>
  )
}