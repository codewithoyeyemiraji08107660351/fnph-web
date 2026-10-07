import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { HubStats } from '@/lib/api/types'
import { formatRelative } from '@/lib/format'

import { formatCount, formatHours } from './dashboard'

type Tone = 'default' | 'warn' | 'alarm' | 'good'

const VALUE_TONE: Record<Tone, string> = {
  default: 'text-ink',
  warn: 'text-gold-700',
  alarm: 'text-alarm',
  good: 'text-forest',
}

/**
 * A number with a label. With `to`, the whole tile is a link to the queue it
 * counts, so the dashboard is also the way into the work.
 */
function Tile({ label, value, note, tone = 'default', to, icon }: {
  label: string
  value: ReactNode
  note?: ReactNode
  tone?: Tone
  to?: string
  icon?: string
}) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        {icon && <i aria-hidden className={`bi ${icon}`} />}
        {label}
      </p>
      <p className={`mt-1 font-display text-3xl font-extrabold tabular-nums tracking-tight ${VALUE_TONE[tone]}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </>
  )
  return to ? (
    <Link
      to={to}
      className="card block px-4 py-4 text-inherit no-underline transition-colors hover:border-accent focus-visible:border-accent"
    >
      {body}
    </Link>
  ) : (
    <div className="card px-4 py-4">{body}</div>
  )
}

/** Queues as they stand. Each tile opens the place the work is done. */
export function NowTiles({ now }: { now: HubStats['now'] }) {
  const waiting = now.awaitingApproval
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile
        label="Awaiting approval"
        icon="bi-inbox"
        value={formatCount(waiting)}
        tone={waiting > 0 ? 'warn' : 'default'}
        note={now.oldestAwaitingSince ? `Oldest arrived ${formatRelative(now.oldestAwaitingSince)}` : 'Desk is clear'}
        to="/hub/approvals"
      />
      <Tile
        label="Upcoming"
        icon="bi-calendar-event"
        value={formatCount(now.upcoming)}
        note={`${formatCount(now.upcomingNext7Days)} in the next 7 days`}
        to="/hub/today"
      />
      <Tile
        label="Today"
        icon="bi-camera-video"
        value={formatCount(now.sessionsToday)}
        note={now.inSession ? `${now.inSession} in session now` : 'None in session now'}
        to="/hub/today"
      />
      <Tile
        label="Ready to release"
        icon="bi-send-check"
        value={formatCount(now.bundlesReady)}
        tone={now.bundlesReady > 0 ? 'warn' : 'default'}
        note={now.bundlesHeld ? `${now.bundlesHeld} held` : `${formatCount(now.bundlesIncomplete)} still incomplete`}
        to="/hub/releases"
      />
      <Tile
        label="Reviews open"
        icon="bi-clipboard2-check"
        value={formatCount(now.reviewsPending + now.reviewsUnassigned)}
        tone={now.reviewsUnassigned > 0 ? 'alarm' : 'default'}
        note={
          now.reviewsUnassigned
            ? `${now.reviewsUnassigned} with no reviewer`
            : now.queriesOpen
              ? `${now.queriesOpen} open ${now.queriesOpen === 1 ? 'query' : 'queries'}`
              : 'All assigned'
        }
        to="/hub/releases"
      />
      <Tile
        label="Follow-ups to schedule"
        icon="bi-calendar-check"
        value={formatCount(now.followUpsToSchedule)}
        tone={now.followUpsOverdue > 0 ? 'alarm' : now.followUpsToSchedule > 0 ? 'warn' : 'default'}
        note={now.followUpsOverdue ? `${now.followUpsOverdue} overdue` : 'None overdue'}
      />
    </div>
  )
}

/** What happened in the chosen period, counted when it happened. */
export function PeriodTiles({ period }: { period: HubStats['period'] }) {
  const decided = period.approved + period.rejected
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Requests received" value={formatCount(period.requests)} note="Paid bookings that reached the desk" />
        <Tile
          label="Approved"
          value={formatCount(period.approved)}
          tone="good"
          note={period.approvalRate != null ? `${period.approvalRate}% of ${formatCount(decided)} decisions` : 'No decisions yet'}
        />
        <Tile
          label="Rejected"
          value={formatCount(period.rejected)}
          tone={period.rejected > 0 ? 'alarm' : 'default'}
          note={decided ? `${(100 - (period.approvalRate ?? 100)).toFixed(1)}% of decisions` : 'No decisions yet'}
        />
        <Tile
          label="Completed sessions"
          value={formatCount(period.completed)}
          note={`${formatCount(period.sessionsHeld)} started, ${formatCount(period.noShows)} not attended`}
        />
        <Tile label="Cancelled" value={formatCount(period.cancelled)} note={`${formatCount(period.rescheduled)} moved to a new time`} />
        <Tile label="Released to patients" value={formatCount(period.released)} note="Clinical bundles released" />
        <Tile label="Review queries" value={formatCount(period.queriesRaised)} note="Raised by pharmacy or laboratory" />
        <Tile label="Hub edits" value={formatCount(period.hubEdits)} note="Reviews and follow-ups corrected" />
      </div>

      <dl className="mt-3 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-3">
        {[
          { label: 'Request to decision', value: period.avgHoursRequestToDecision, note: 'Average time on the desk' },
          { label: 'Review turnaround', value: period.avgHoursReviewTurnaround, note: 'Assigned to submitted' },
          { label: 'Session to release', value: period.avgHoursSessionToRelease, note: 'Session end to patient release' },
        ].map((m) => (
          <div key={m.label} className="bg-white px-4 py-3">
            <dt className="text-xs font-semibold text-muted">{m.label}</dt>
            <dd className={`mt-0.5 text-lg font-extrabold tabular-nums ${m.value == null ? 'text-muted' : 'text-ink'}`}>
              {formatHours(m.value)}
            </dd>
            <dd className="text-xs text-muted">{m.note}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}