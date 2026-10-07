import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { dashboardApi } from '@/lib/api/endpoints/hub'
import { formatLongDate } from '@/lib/format'

import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'

import { ActivityFeed } from './ActivityFeed'
import { ConsultationDialog, type ConsultationRef } from './ConsultationDialog'
import { DailyChart } from './DailyChart'
import { boardWindow, formatShortDay, PERIODS, periodWindow, type PeriodKey } from './dashboard'
import { NowTiles, PeriodTiles } from './StatTiles'
import { UpcomingList } from './UpcomingList'
import { WorkflowBoard } from './WorkflowBoard'
import { WorkloadTable } from './WorkloadTable'

function SectionHeading({ children, note }: { children: string; note?: string }) {
  return (
    <div className="mb-3 mt-8 flex flex-wrap items-baseline justify-between gap-2 first:mt-0">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{children}</h2>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  )
}

/**
 * The Hub Coordinator's home: what needs doing now, what happened in the
 * period, what is coming, every consultation's stage and team, and the full
 * activity record. Every number links to where the work is done.
 */
export function HubDashboard() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('30d')
  const [open, setOpen] = useState<ConsultationRef | null>(null)

  const period = periodWindow(periodKey)
  const board = boardWindow(period)

  const stats = useQuery({
    queryKey: ['hub-stats', period.from, period.to],
    queryFn: () => dashboardApi.stats(period),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })

  const periodLabel = PERIODS.find((p) => p.key === periodKey)!.label
  const rangeNote = period.from === period.to
    ? formatShortDay(period.to)
    : `${formatShortDay(period.from)} to ${formatShortDay(period.to)}`

  return (
    <>
      <PageHeader
        kicker="Hub coordination"
        title="Dashboard"
        description={`${formatLongDate()}. Queues refresh every minute.`}
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

      {stats.isLoading && <Spinner label="Loading dashboard" />}
      {stats.isError && (
        <Panel>
          <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
        </Panel>
      )}

      {stats.data && (
        <>
          <SectionHeading>Needs you now</SectionHeading>
          <NowTiles now={stats.data.now} />

          <SectionHeading note={rangeNote}>{periodKey === 'today' ? 'Today so far' : `Last ${periodLabel}`}</SectionHeading>
          <PeriodTiles period={stats.data.period} />

          <div className="mt-5 grid gap-5 *:min-w-0 lg:grid-cols-[1.6fr_1fr]">
            <Panel title="Daily activity">
              <DailyChart days={stats.data.daily} />
            </Panel>
            <UpcomingList onOpen={(row) => setOpen(row)} />
          </div>
        </>
      )}

      <SectionHeading>Consultations</SectionHeading>
      <WorkflowBoard key={`${board.from}:${board.to}`} range={board} onOpen={(row) => setOpen(row)} />

      <div className="mt-5 grid gap-5 *:min-w-0 xl:grid-cols-[1.6fr_1fr]">
        <ActivityFeed
          range={period}
          onOpen={(item) =>
            item.appointmentPublicId &&
            setOpen({ appointmentPublicId: item.appointmentPublicId, reference: item.reference, patientName: item.patientName })
          }
        />
        {stats.data && <WorkloadTable workload={stats.data.workload} />}
      </div>

      {open && <ConsultationDialog consultation={open} onClose={() => setOpen(null)} />}
    </>
  )
}