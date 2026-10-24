import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { paymentApi } from '@/lib/api/endpoints/patient'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Connect Gateway does not require the old RRR/eChannel return flow.
 *
 * The backend is authoritative:
 * - SUCCESS -> patient can continue to booking
 * - PENDING -> remain on payment step
 * - FAILED -> remain on payment step
 */
export function PaymentReturn() {
  const payments = useQuery({
    queryKey: ['my-payments', 'payment-return'],
    queryFn: paymentApi.mine,
  })

  if (payments.isLoading) {
    return <Spinner label="Checking your payment" />
  }

  const openPayment = payments.data?.find(
    (payment) =>
      !payment.usedForBooking &&
      payment.status === 'SUCCESS',
  )

  if (openPayment) {
    return (
      <Navigate
        to="/portal/booking"
        replace
        state={{
          notice:
            'Payment confirmed. Choose your consultation date and time.',
          paymentReference: openPayment.reference,
        }}
      />
    )
  }

  return (
    <Navigate
      to="/portal/appointments"
      replace
      state={{
        notice:
          'Your completed booking and consultation status appear here.',
      }}
    />
  )
}