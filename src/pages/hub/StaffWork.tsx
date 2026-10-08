import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { staffWorkApi } from '@/lib/api/endpoints/staffWork'
import type { StaffWorkRow, WorkRole } from '@/lib/api/types'

import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'

import { formatCount, formatShortDay, PERIODS, periodWindow, type PeriodKey } from './dashboard/dashboard'

const ORDER: WorkRole[] = ['DOCTOR', 'NURSE', 'PHARMACIST', 'LABORATORY', 'HIM']
const PLURAL: Record<WorkRole, string> = {
  DOCTOR: 'Doctors',
  NURSE: 'Nurses',
  PHARMACIST: 'Pharmacists',
  LABORATORY: 'Laboratory technicians',
  HIM: 'HIM officers',
}

function Group({ role, rows }: { role: WorkRole; rows: StaffWorkRow[] }) {
  return (
    <Panel title={PLURAL[role]} bodyClassName="" action={<span className="text-sm text-muted">{rows.length}</span>}>
      {rows.length === 0 ? (
        <EmptyState icon="bi-people" title={`No active ${PLURAL[role].toLowerCase()}`} />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={`${r.publicId}-${r.role}`}>
              <Link
                to={`/hub/staff/${encodeURIComponent(r.publicId)}?role=${r.role}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-inherit no-underline hover:bg-soft/60"
              >
                <span className="font-bold">{r.name}</span>
                <span className="flex flex-wrap gap-4 text-sm">
                  <span><b className="tabular-nums">{formatCount(r.done)}</b> <span className="text-muted">{r.doneLabel}</span></span>
                  <span className={r.waiting > 0 ? 'text-gold-700' : 'text-muted'}>
                    <b className="tabular-nums">{formatCount(r.waiting)}</b> {r.waitingLabel}
                  </span>
                  <i aria-hidden className="bi bi-chevron-right text-muted" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/** Every doctor, nurse, reviewer and HIM officer, with what they did and what waits on them. */
export function StaffWork() {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('30d')
  const range = periodWindow(periodKey)
  const staff = useQuery({
    queryKey: ['staff-work', range.from, range.to],
    queryFn: () => staffWorkApi.staff(range),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })

  const byRole = useMemo(() => {
    const out = new Map<WorkRole, StaffWorkRow[]>(ORDER.map((r) => [r, []]))
    for (const row of staff.data ?? []) out.get(row.role)?.push(row)
    for (const rows of out.values()) rows.sort((a, b) => b.waiting - a.waiting || b.done - a.done || a.name.localeCompare(b.name))
    return out
  }, [staff.data])

  return (
    <>
      <PageHeader
        kicker="Hub coordination"
        title="Team work"
        description={`What each doctor, nurse, reviewer and HIM officer did ${range.from === range.to ? 'today' : `from ${formatShortDay(range.from)} to ${formatShortDay(range.to)}`}, and what is waiting on them now. Open anyone for their full history.`}
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
      {staff.isLoading && <Spinner label="Loading the team" />}
      {staff.isError && <Panel><ErrorState error={staff.error} onRetry={() => staff.refetch()} /></Panel>}
      {staff.data && (
        <div className="grid gap-5 *:min-w-0 xl:grid-cols-2">
          {ORDER.map((role) => <Group key={role} role={role} rows={byRole.get(role) ?? []} />)}
        </div>
      )}
    </>
  )
}
