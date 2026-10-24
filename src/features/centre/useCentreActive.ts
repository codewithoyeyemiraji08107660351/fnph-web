import { useQuery } from '@tanstack/react-query'
import { centreApi } from '@/lib/api/endpoints/centre'

/**
 * Whether this centre can refer and book. The server refuses both at a
 * suspended or onboarding centre, so the screens should not offer them.
 * Unknown while loading counts as active, to avoid flashing the actions away.
 */
export function useCentreActive() {
  const me = useQuery({ queryKey: ['centre-me'], queryFn: centreApi.me, staleTime: 60_000 })
  return { active: !me.data || me.data.status === 'ACTIVE', status: me.data?.status }
}
