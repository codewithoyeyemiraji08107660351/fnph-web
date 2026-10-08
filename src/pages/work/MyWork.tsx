import { WorkDashboard } from '@/features/work/WorkDashboard'

/** A doctor's, reviewer's or HIM officer's own dashboard and work history. */
export function MyWork() {
  return <WorkDashboard who={{ kind: 'me' }} kicker="Your work" />
}
