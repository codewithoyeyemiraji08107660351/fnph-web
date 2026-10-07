import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { dashboardApi } from '@/lib/api/endpoints/hub'
import type { BoardRow, WorkflowStage } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'

import { Badge } from '@/components/ui/Badge'
import { TextField } from '@/components/ui/Field'
import { EmptyState, ErrorState, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'

import { STAGE_LABEL, STAGE_TONE } from '../oversight'
import { formatShortDay, type Window } from './dashboard'
import { teamGaps, teamSummary } from './teamGaps'

/** Journey order, so the tabs read left to right like the work does. */
const STAGES: WorkflowStage[] = [
  'APPROVAL', 'SCHEDULED', 'IN_SESSION', 'DOCUMENTATION', 'REVIEWS',
  'AWAITING_RELEASE', 'HELD', 'FOLLOW_UP', 'CLOSED', 'ENDED',
]

const PAGE_SIZE = 20

function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

function Reviews({ reviews }: { reviews: BoardRow['reviews'] }) {
  if (reviews.total === 0) return <span className="text-muted">None</span>
  if (reviews.unassigned) return <span className="font-semibold text-alarm">{reviews.unassigned} unassigned</span>
  if (reviews.queries) return <span className="font-semibold text-gold-700">{reviews.queries} {reviews.queries === 1 ? 'query' : 'queries'}</span>
  if (reviews.pending) return <span>{reviews.pending} of {reviews.total} open</span>
  return <span className="text-forest">All {reviews.total} done</span>
}

/**
 * Every consultation in the window with its stage and full team. A row opens
 * that consultation's history.
 */
export function WorkflowBoard({ range, onOpen }: { range: Window; onOpen: (row: BoardRow) => void }) {
  const [stage, setStage] = useState<WorkflowStage | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const q = useDebounced(search.trim())

  // A new filter starts from the first page. A new window remounts the board (keyed by the parent).
  const chooseStage = (next: WorkflowStage | null) => {
    setStage(next)
    setPage(0)
  }

  const board = useQuery({
    queryKey: ['hub-board', range.from, range.to, stage, q, page],
    queryFn: () =>
      dashboardApi.workflow({
        from: range.from,
        to: range.to,
        stage: stage ?? undefined,
        q: q || undefined,
        page,
        size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })

  const data = board.data
  const counts = data?.stageCounts ?? {}
  const all = Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0)
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1

  return (
    <Panel
      title="Workflow"
      action={
        <span className="text-xs text-muted">
          Dated {formatShortDay(range.from)} to {formatShortDay(range.to)}
        </span>
      }
      bodyClassName=""
    >
      <div className="flex flex-col gap-3 border-b border-line px-5 py-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Stage">
          <button type="button" aria-pressed={stage === null} onClick={() => chooseStage(null)} className={`btn btn-sm ${stage === null ? 'btn-secondary' : 'btn-quiet'}`}>
            All <span className="tabular-nums text-muted">{all}</span>
          </button>
          {STAGES.filter((s) => (counts[s] ?? 0) > 0 || s === stage).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={stage === s}
              onClick={() => chooseStage(stage === s ? null : s)}
              className={`btn btn-sm ${stage === s ? 'btn-secondary' : 'btn-quiet'}`}
            >
              {STAGE_LABEL[s]} <span className="tabular-nums text-muted">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <TextField
          wrapperClassName="w-full lg:w-64"
          label="Search"
          placeholder="Reference, EHR number or name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
      </div>

      {board.isLoading && <div className="p-5"><Spinner label="Loading consultations" /></div>}
      {board.isError && <ErrorState error={board.error} onRetry={() => board.refetch()} />}
      {data && data.rows.length === 0 && (
        <EmptyState icon="bi-kanban" title={q || stage ? 'No consultations match' : 'No consultations in this window'} />
      )}

      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table-base min-w-[880px]">
            <thead>
              <tr>
                <th>When</th>
                <th>Patient</th>
                <th>Stage</th>
                <th>Doctor and room</th>
                <th>Team</th>
                <th>Reviews</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const gaps = teamGaps(row.team).filter((g) => g !== 'doctor' && g !== 'room')
                const members = teamSummary(row.team)
                // Gaps only matter while the team can still be changed or is about to work.
                const showGaps = row.stage === 'APPROVAL' || row.stage === 'SCHEDULED'
                return (
                  <tr key={row.appointmentPublicId}>
                    <td className="whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpen(row)}
                        className="text-left font-bold text-accent-strong underline-offset-2 hover:underline"
                      >
                        {formatDateTime(row.appointmentDate)}
                      </button>
                      <span className="block text-xs text-muted">{row.reference}</span>
                    </td>
                    <td>
                      {row.patientName ?? 'Patient'}
                      <span className="block text-xs text-muted">EHR {row.ehrNumber ?? 'not recorded'}</span>
                    </td>
                    <td><Badge tone={STAGE_TONE[row.stage]}>{STAGE_LABEL[row.stage]}</Badge></td>
                    <td className="text-sm">
                      {row.team.doctor ?? <span className="text-gold-700">No doctor</span>}
                      <span className="block text-xs text-muted">{row.team.room ?? 'No room'}</span>
                    </td>
                    <td className="text-sm">
                      {members.length === 0 ? (
                        <span className="text-muted">Not assigned</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {members.map((m) => (
                            <li key={m.label}>
                              <span className="text-xs text-muted">{m.label}</span> {m.name}
                            </li>
                          ))}
                        </ul>
                      )}
                      {showGaps && gaps.length > 0 && members.length > 0 && (
                        <span className="mt-0.5 block text-xs font-semibold text-gold-700">No {gaps.join(', ')}</span>
                      )}
                    </td>
                    <td className="text-sm"><Reviews reviews={row.reviews} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > data.size && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
          <span className="text-muted">
            {data.page * data.size + 1} to {Math.min(data.total, (data.page + 1) * data.size)} of {data.total}
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0 || board.isFetching} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page + 1 >= pages || board.isFetching} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </Panel>
  )
}