import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { dashboardApi } from '@/lib/api/endpoints/hub'
import type { BoardRow } from '@/lib/api/types'
import { formatTime, parseServerTime, DISPLAY_TIME_ZONE } from '@/lib/format'

import { EmptyState, ErrorState, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'

import { addDays, watToday } from './dashboard'
import { teamGaps } from './teamGaps'

const dayLabel = new Intl.DateTimeFormat('en-GB', { timeZone: DISPLAY_TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' })

/** Confirmed consultations in the next seven days, soonest first. */
export function UpcomingList({ onOpen }: { onOpen: (row: BoardRow) => void }) {
  const today = watToday()
  const upcoming = useQuery({
    queryKey: ['hub-upcoming', today],
    queryFn: () => dashboardApi.workflow({ from: today, to: addDays(today, 7), stage: 'SCHEDULED', order: 'asc', size: 8 }),
    refetchInterval: 60_000,
  })

  const rows = upcoming.data?.rows ?? []
  const more = (upcoming.data?.total ?? 0) - rows.length

  return (
    <Panel
      title="Upcoming consultations"
      action={<Link to="/hub/today" className="text-sm font-bold">Day view</Link>}
      bodyClassName=""
    >
      {upcoming.isLoading && <div className="p-5"><Spinner label="Loading upcoming consultations" /></div>}
      {upcoming.isError && <ErrorState error={upcoming.error} onRetry={() => upcoming.refetch()} />}
      {upcoming.isSuccess && rows.length === 0 && (
        <EmptyState icon="bi-calendar" title="Nothing confirmed in the next 7 days" />
      )}
      {rows.length > 0 && (
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const gaps = teamGaps(row.team)
            const date = parseServerTime(row.appointmentDate)
            return (
              <li key={row.appointmentPublicId}>
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-canvas focus-visible:bg-canvas"
                >
                  <span className="w-16 shrink-0">
                    <span className="block text-sm font-bold tabular-nums">{formatTime(row.appointmentDate)}</span>
                    <span className="block text-xs text-muted">{date ? dayLabel.format(date) : ''}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{row.patientName ?? 'Patient'}</span>
                    <span className="block truncate text-xs text-muted">
                      {row.team.doctor ?? 'No doctor'} · {row.team.room ?? 'No room'}
                    </span>
                    {gaps.length > 0 && (
                      <span className="mt-0.5 block text-xs font-semibold text-gold-700">No {gaps.join(', ')}</span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {more > 0 && <p className="border-t border-line px-5 py-2.5 text-xs text-muted">And {more} more this week</p>}
    </Panel>
  )
}