import { useQueryClient } from '@tanstack/react-query'

/**
 * Everything on the centre's screens that a referral or booking action can
 * change. Invalidating only the referral list left Consultations and the home
 * counts stale for up to the cache lifetime after a request was sent.
 */
export function useCentreRefresh() {
  const qc = useQueryClient()
  return () =>
    Promise.all(
      [['centre-referrals'], ['centre-patient-referrals'], ['centre-appointments'], ['centre-me'], ['centre-times']].map((queryKey) =>
        qc.invalidateQueries({ queryKey }),
      ),
    )
}
