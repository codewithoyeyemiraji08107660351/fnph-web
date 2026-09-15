import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { bookingApi } from '@/lib/api/endpoints/patient'
import { parseServerTime } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { useNow } from '@/lib/hooks/useNow'

/** Remita returns here. Where the patient goes depends on the server, not on the return itself. */
export function PaymentReturn() {
  const now = useNow(60_000)
  const mine = useQuery({ queryKey: ['my-appointments'], queryFn: bookingApi.mine })
  if (mine.isLoading) return <Spinner label="Checking your payment" />
  const live = mine.data?.some((a) => a.status === 'SLOT_HELD' && (parseServerTime(a.heldUntil)?.getTime() ?? 0) > now)
  if (live) return <Navigate to="/portal/booking" replace />
  return <Navigate to="/portal/appointments" replace state={{ notice: 'If you paid, your booking appears here once Remita confirms it. That usually takes a minute.' }} />
}
