import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { paymentApi } from '@/lib/api/endpoints/patient'
import { parseServerTime } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { useNow } from '@/lib/hooks/useNow'

/**
 * Where Remita sends the patient back after the hosted payment page.
 *
 * The backend is authoritative. Remita's notification can arrive after the
 * patient does, so a payment still PENDING here is checked once on the spot
 * and, if not yet confirmed, the patient goes back to the payment step, which
 * keeps checking while it is open. The server's pending sweep confirms it
 * within minutes even if they close the page.
 */
export function PaymentReturn() {
  const now = useNow(60_000)
  const payments = useQuery({
    queryKey: ['my-payments', 'payment-return'],
    queryFn: paymentApi.mine,
  })

  const unused = (payments.data ?? []).filter((p) => !p.usedForBooking)
  const paid = unused.find((p) => p.status === 'SUCCESS')
  const pending = paid
    ? undefined
    : unused.find(
        (p) =>
          p.status === 'PENDING' &&
          (parseServerTime(p.expiresAt)?.getTime() ?? Number.MAX_SAFE_INTEGER) > now,
      )

  const check = useQuery({
    queryKey: ['payment-return-verify', pending?.reference],
    queryFn: () => paymentApi.verify(pending!.reference),
    enabled: Boolean(pending),
    retry: false,
  })

  if (payments.isLoading || (pending && check.isLoading)) {
    return <Spinner label="Checking your payment" />
  }

  const confirmed = paid ?? (check.data?.status === 'SUCCESS' ? check.data : undefined)

  if (confirmed) {
    return (
      <Navigate
        to="/portal/booking"
        replace
        state={{
          notice: 'Payment confirmed. Choose your consultation date and time.',
          paymentReference: confirmed.reference,
        }}
      />
    )
  }

  if (pending) {
    return (
      <Navigate
        to="/portal/booking"
        replace
        state={{
          notice:
            'We are confirming your payment with Remita. This usually takes a minute or two. You do not need to pay again.',
          paymentReference: pending.reference,
        }}
      />
    )
  }

  return (
    <Navigate
      to="/portal/appointments"
      replace
      state={{
        notice: 'Your completed booking and consultation status appear here.',
      }}
    />
  )
}
