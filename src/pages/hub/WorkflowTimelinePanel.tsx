import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { oversightApi } from '@/lib/api/endpoints/hub'
import type { TimelineCategory, TimelineEvent } from '@/lib/api/types'
import { DISPLAY_TIME_ZONE, formatTime, parseServerTime } from '@/lib/format'

import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'

import { formatMinutes, oversightKeys, STAGE_LABEL, STAGE_TONE } from './oversight'

const CATEGORY: Record<TimelineCategory, { label: string; icon: string }> = {
  BOOKING: { label: 'Booking', icon: 'bi-calendar-event' },
  TEAM: { label: 'Team', icon: 'bi-people' },
  SESSION: { label: 'Session', icon: 'bi-camera-video' },
  CLINICAL: { label: 'Clinical', icon: 'bi-file-medical' },
  REVIEW: { label: 'Reviews', icon: 'bi-clipboard2-check' },
  RELEASE: { label: 'Release', icon: 'bi-send-check' },
  FOLLOW_UP: { label: 'Follow-up', icon: 'bi-calendar-check' },
  EDIT: { label: 'Hub edits', icon: 'bi-pencil-square' },
}

const ORDER = Object.keys(CATEGORY) as TimelineCategory[]

const dayHeading = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Groups consecutive events by hospital day, keeping their order. */
function byDay(events: TimelineEvent[]) {
  const days: Array<{ day: string; events: TimelineEvent[] }> = []
  for (const event of events) {
    const date = parseServerTime(event.at)
    const day = date ? dayHeading.format(date) : 'Undated'
    const last = days[days.length - 1]
    if (last && last.day === day) last.events.push(event)
    else days.push({ day, events: [event] })
  }
  return days
}

function Milestone({ label, minutes }: { label: string; minutes?: number | null }) {
  const value = formatMinutes(minutes)
  return (
    <div className="bg-white px-4 py-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={value ? 'text-sm font-bold' : 'text-sm text-muted'}>{value ?? 'Not yet'}</dd>
    </div>
  )
}

/** Booking to follow-up for one consultation, merged from every record. */
export function WorkflowTimelinePanel({
  appointmentPublicId,
  className = 'mt-5',
}: {
  appointmentPublicId: string
  className?: string
}) {
  const [hidden, setHidden] = useState<Set<TimelineCategory>>(new Set())
  const timeline = useQuery({
    queryKey: oversightKeys.timeline(appointmentPublicId),
    queryFn: () => oversightApi.timeline(appointmentPublicId),
  })

  const present = useMemo(() => {
    const counts = new Map<TimelineCategory, number>()
    for (const e of timeline.data?.events ?? []) counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
    return ORDER.filter((c) => counts.has(c)).map((c) => ({ category: c, count: counts.get(c)! }))
  }, [timeline.data])

  const visible = useMemo(
    () => (timeline.data?.events ?? []).filter((e) => !hidden.has(e.category)),
    [timeline.data, hidden],
  )

  const toggle = (category: TimelineCategory) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })

  const t = timeline.data

  return (
    <Panel
      title="Workflow history"
      action={t ? <Badge tone={STAGE_TONE[t.stage]}>{STAGE_LABEL[t.stage]}</Badge> : undefined}
      className={className}
      bodyClassName=""
    >
      {timeline.isLoading && (
        <div className="p-5">
          <Spinner label="Loading workflow history" />
        </div>
      )}
      {timeline.isError && <ErrorState error={timeline.error} onRetry={() => timeline.refetch()} />}

      {t && (
        <>
          <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
            <Milestone label="Booked to approved" minutes={t.durations.bookedToApproved} />
            <Milestone label="Approved to session" minutes={t.durations.approvedToSessionStart} />
            <Milestone label="Session length" minutes={t.durations.sessionLength} />
            <Milestone label="Session to release" minutes={t.durations.sessionEndToRelease} />
          </dl>

          {present.length > 1 && (
            <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3" role="group" aria-label="Show event types">
              {present.map(({ category, count }) => {
                const on = !hidden.has(category)
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(category)}
                    className={`btn btn-sm ${on ? 'btn-secondary' : 'btn-quiet text-muted line-through'}`}
                  >
                    <i aria-hidden className={`bi ${CATEGORY[category].icon}`} /> {CATEGORY[category].label}{' '}
                    <span className="text-muted">{count}</span>
                  </button>
                )
              })}
            </div>
          )}

          {visible.length === 0 ? (
            <EmptyState icon="bi-clock-history" title={t.events.length ? 'Every event type is hidden' : 'Nothing recorded yet'} />
          ) : (
            <div className="px-5 py-4">
              {byDay(visible).map(({ day, events }) => (
                <section key={day} className="mb-4 last:mb-0">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{day}</h3>
                  <ol className="relative ml-2 border-l border-line">
                    {events.map((e, i) => (
                      <li key={`${e.at}-${i}`} className="relative pb-3 pl-6 last:pb-0">
                        <span
                          aria-hidden
                          className="absolute -left-[11px] top-0.5 grid h-5 w-5 place-items-center rounded-full border border-line bg-white text-[0.7rem] text-muted"
                        >
                          <i className={`bi ${CATEGORY[e.category].icon}`} />
                        </span>
                        <p className="text-sm">
                          <span className="mr-2 tabular-nums text-muted">{formatTime(e.at)}</span>
                          <span className="font-bold">{e.title}</span>
                        </p>
                        {(e.detail || e.actor) && (
                          <p className="mt-0.5 text-xs text-muted">
                            {e.detail && <span className="whitespace-pre-wrap">{e.detail}</span>}
                            {e.detail && e.actor && ' · '}
                            {e.actor}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
