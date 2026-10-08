import { useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { staffWorkApi, type WorkSubject } from '@/lib/api/endpoints/staffWork'
import type { WorkMetric, WorkRole } from '@/lib/api/types'
import { formatLongDate, formatRelative } from '@/lib/format'

import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { formatShortDay, PERIODS, periodWindow, type PeriodKey } from '@/pages/hub/dashboard/dashboard'

import { WorkChart } from './WorkChart'
import { WorkHistory, type OpenConsultation } from './WorkHistory'
import { formatMetric, WORK_ROLE_LABEL } from './workFormat'

const TONE = { alarm: 'text-alarm', warn: 'text-gold-700' } as const

/** "3 hours ago" is the oldest waiting item; "in 20 hours" is the next session the work is needed for. */
const sinceText = (relative: string) => (relative.startsWith('in ') ? `Next needed ${relative}` : `Oldest ${relative}`)

function MetricTile({ metric, big = false }: { metric: WorkMetric; big?: boolean }) {
  const tone = metric.tone ? TONE[metric.tone] : 'text-ink'
  const empty = metric.value == null && metric.format !== 'count'
  return (
    <div className="card px-4 py-4">
      <p className="text-xs font-semibold text-muted">{metric.label}</p>
      <p className={`mt-1 font-display font-extrabold tabular-nums tracking-tight ${big ? 'text-3xl' : 'text-2xl'} ${empty ? 'text-base font-semibold text-muted' : tone}`}>
        {formatMetric(metric)}
      </p>
      {(metric.since || metric.hint) && (
        <p className="mt-1 text-xs text-muted">
          {metric.since
            // A future time is the next session the work is needed for.
            ? sinceText(formatRelative(metric.since))
            : metric.hint}
        </p>
      )}
    </div>
  )
}

function SectionHeading({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="mb-3 mt-8 flex flex-wrap items-baseline justify-between gap-2 first:mt-0">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{children}</h2>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  )
}

/**
 * One person's work: what is waiting on them, what they did in the period,
 * a daily chart, and the history behind every number. The same screen for
 * the person themselves and for the Hub Coordinator looking at them.
 */
export function WorkDashboard({
  who,
  kicker,
  backLink,
  onOpen,
  initialRole,
}: {
  who: WorkSubject
  /** Which of the person's roles to open on, when they hold several. */
  initialRole?: WorkRole
  kicker: string
  backLink?: ReactNode
  /** Hub Coordinator only: open a consultation's workflow and team. */
  onOpen?: (c: OpenConsultation) => void
}) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('30d')
  const [role, setRole] = useState<WorkRole | undefined>(initialRole)
  const range = periodWindow(periodKey)

  const summary = useQuery({
    queryKey: ['work-summary', who, role ?? null, range.from, range.to],
    queryFn: () => staffWorkApi.summary(who, { role, ...range }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const data = summary.data
  const mine = who.kind === 'me'
  const activeRole = data?.role
  const periodLabel = PERIODS.find((p) => p.key === periodKey)!.label
  const rangeNote = range.from === range.to ? formatShortDay(range.to) : `${formatShortDay(range.from)} to ${formatShortDay(range.to)}`

  return (
    <>
      {backLink}
      <PageHeader
        kicker={kicker}
        title={mine ? 'My work' : data?.person.name ?? 'Team member'}
        description={
          data
            ? `${WORK_ROLE_LABEL[data.role]}. ${formatLongDate()}.`
            : undefined
        }
        actions={
          <div className="flex rounded-[var(--radius-control)] border border-line bg-white p-1" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={periodKey === p.key}
                onClick={() => setPeriodKey(p.key)}
                className={`min-h-9 rounded-[calc(var(--radius-control)-4px)] px-3 text-sm font-semibold ${
                  periodKey === p.key ? 'bg-accent text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {data && data.roles.length > 1 && (
        <div className="-mt-2 mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Role">
          {data.roles.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={activeRole === r}
              onClick={() => setRole(r)}
              className={`btn btn-sm ${activeRole === r ? 'btn-secondary' : 'btn-quiet'}`}
            >
              {WORK_ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      )}

      {summary.isLoading && <Spinner label="Loading work history" />}
      {summary.isError && (
        <Panel>
          <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
        </Panel>
      )}

      {data && (
        <div className={summary.isFetching && summary.isPlaceholderData ? 'opacity-70' : ''}>
          <SectionHeading>{mine ? 'Waiting on you' : 'Waiting on them'}</SectionHeading>
          <div className="grid grid-cols-2 gap-3 *:min-w-0 md:grid-cols-4">
            {data.now.map((m) => <MetricTile key={m.key} metric={m} big />)}
          </div>

          <SectionHeading note={rangeNote}>{periodKey === 'today' ? 'Today' : `Last ${periodLabel}`}</SectionHeading>
          <div className="grid grid-cols-2 gap-3 *:min-w-0 sm:grid-cols-3 xl:grid-cols-5">
            {data.period.map((m) => <MetricTile key={m.key} metric={m} />)}
          </div>

          {data.measures.length > 0 && data.daily.length > 1 && (
            <Panel title="Day by day" className="mt-5">
              <WorkChart key={data.role} days={data.daily} measures={data.measures} />
            </Panel>
          )}

          <div className="mt-5">
            <WorkHistory
              key={`${data.role}:${range.from}:${range.to}`}
              who={who}
              role={data.role}
              from={range.from}
              to={range.to}
              onOpen={onOpen}
            />
          </div>
        </div>
      )}
    </>
  )
}
