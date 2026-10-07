import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

import { dashboardApi } from '@/lib/api/endpoints/hub'
import type { ActivityGroup, ActivityItem } from '@/lib/api/types'
import { DISPLAY_TIME_ZONE, formatTime, parseServerTime } from '@/lib/format'

import { EmptyState, ErrorState, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'

import { ACTIVITY_GROUPS, GROUP_ICON, GROUP_TONE, type Window } from './dashboard'

const PAGE = 30

const dayHeading = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function byDay(items: ActivityItem[]) {
  const days: Array<{ day: string; items: ActivityItem[] }> = []
  for (const item of items) {
    const date = parseServerTime(item.at)
    const day = date ? dayHeading.format(date) : 'Undated'
    const last = days[days.length - 1]
    if (last?.day === day) last.items.push(item)
    else days.push({ day, items: [item] })
  }
  return days
}

/**
 * Everything that happened to consultations in the period, newest first.
 * Filters are additive; none selected means everything.
 */
export function ActivityFeed({ range, onOpen }: { range: Window; onOpen: (item: ActivityItem) => void }) {
  const [groups, setGroups] = useState<ActivityGroup[]>([])

  const feed = useInfiniteQuery({
    queryKey: ['hub-activity', range.from, range.to, groups],
    queryFn: ({ pageParam }) =>
      dashboardApi.activity({
        from: range.from,
        to: range.to,
        group: groups.length ? groups : undefined,
        before: pageParam ?? undefined,
        limit: PAGE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore ?? null,
    refetchInterval: 60_000,
  })

  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data])

  const toggle = (group: ActivityGroup) =>
    setGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]))

  return (
    <Panel title="Activity" bodyClassName="">
      <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3" role="group" aria-label="Show activity of type">
        <button type="button" aria-pressed={groups.length === 0} onClick={() => setGroups([])} className={`btn btn-sm ${groups.length === 0 ? 'btn-secondary' : 'btn-quiet'}`}>
          Everything
        </button>
        {ACTIVITY_GROUPS.map((g) => {
          const on = groups.includes(g.key)
          return (
            <button key={g.key} type="button" aria-pressed={on} onClick={() => toggle(g.key)} className={`btn btn-sm ${on ? 'btn-secondary' : 'btn-quiet'}`}>
              <i aria-hidden className={`bi ${g.icon}`} /> {g.label}
            </button>
          )
        })}
      </div>

      {feed.isLoading && <div className="p-5"><Spinner label="Loading activity" /></div>}
      {feed.isError && <ErrorState error={feed.error} onRetry={() => feed.refetch()} />}
      {feed.isSuccess && items.length === 0 && (
        <EmptyState icon="bi-activity" title="Nothing recorded in this period" />
      )}

      {items.length > 0 && (
        <div className="max-h-[640px] overflow-y-auto px-5 py-4">
          {byDay(items).map(({ day, items: dayItems }) => (
            <section key={day} className="mb-5 last:mb-0">
              <h3 className="sticky top-0 z-[1] mb-2 bg-white py-1 text-xs font-bold uppercase tracking-wide text-muted">{day}</h3>
              <ol className="space-y-3">
                {dayItems.map((item, i) => (
                  <li key={`${item.at}-${item.type}-${i}`} className="flex gap-3">
                    <span
                      aria-hidden
                      className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line bg-canvas text-sm ${GROUP_TONE[item.group] ?? 'text-muted'}`}
                    >
                      <i className={`bi ${GROUP_ICON[item.group]}`} />
                    </span>
                    <div className="min-w-0 flex-1 break-words">
                      <p className="text-sm">
                        <span className="mr-2 tabular-nums text-muted">{formatTime(item.at)}</span>
                        <span className="font-bold">{item.title}</span>
                        {item.appointmentPublicId && (
                          <>
                            {' · '}
                            <button
                              type="button"
                              onClick={() => onOpen(item)}
                              className="font-semibold text-accent-strong underline-offset-2 hover:underline"
                            >
                              {item.patientName ?? 'Patient'}
                              {item.reference && <span className="font-normal text-muted"> {item.reference}</span>}
                            </button>
                          </>
                        )}
                      </p>
                      {(item.detail || item.actor) && (
                        <p className="mt-0.5 text-xs text-muted">
                          {item.detail && <span className="whitespace-pre-wrap">{item.detail}</span>}
                          {item.detail && item.actor && ' · '}
                          {item.actor && <span>by {item.actor}</span>}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          {feed.hasNextPage && (
            <button
              type="button"
              className="btn btn-secondary btn-sm mt-4 w-full"
              disabled={feed.isFetchingNextPage}
              onClick={() => feed.fetchNextPage()}
            >
              {feed.isFetchingNextPage ? 'Loading' : 'Load earlier activity'}
            </button>
          )}
        </div>
      )}
    </Panel>
  )
}