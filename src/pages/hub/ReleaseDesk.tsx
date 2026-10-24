import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { releaseApi } from '@/lib/api/endpoints/hub'
import type { DeskReview, DeskReviewState, ReassignableRole, ReleaseDeskRow } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, formatRelative, formatTime, humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { LIVE } from './oversight'
import { ReassignDialog } from './ReassignDialog'
import { CentreReviewerDialog } from './CentreReviewerDialog'

const FILTERS: Array<{ value: ReleaseDeskRow['status'] | ''; label: string }> = [
  { value: '', label: 'All unreleased' },
  { value: 'READY', label: 'Ready to release' },
  { value: 'INCOMPLETE', label: 'Waiting on a component' },
  { value: 'BLOCKED', label: 'Blocked' },
]

export function BundleStatusBadge({ status }: { status: string }) {
  if (status === 'READY') return <Badge tone="green">Ready</Badge>
  if (status === 'BLOCKED') return <Badge tone="red">Blocked</Badge>
  if (status === 'RELEASED') return <Badge tone="navy">Released</Badge>
  return <Badge tone="gold">Incomplete</Badge>
}

const REVIEW_STATE: Record<DeskReviewState, { label: string; tone: 'red' | 'gold' | 'navy' }> = {
  UNASSIGNED: { label: 'No reviewer', tone: 'red' },
  NOT_OPENED: { label: 'Not opened', tone: 'gold' },
  IN_PROGRESS: { label: 'In review', tone: 'navy' },
  QUERY_RAISED: { label: 'Query raised', tone: 'red' },
}

const REVIEW_ROLE: Record<DeskReview['reviewType'], ReassignableRole> = {
  PHARMACY: 'PHARMACIST',
  LABORATORY: 'LABORATORY',
}

interface Reassigning {
  appointmentPublicId: string
  role: ReassignableRole
}

interface CentreAssigning {
  bundlePublicId: string
  type: DeskReview['reviewType']
  centreName?: string | null
  currentName?: string | null
}

/** Who each waiting review is with, how long it has waited, and a way to move it. */
function OpenReviews({
  reviews,
  canReassign,
  onReassign,
}: {
  reviews: DeskReview[]
  canReassign: boolean
  onReassign: (review: DeskReview) => void
}) {
  if (reviews.length === 0) return null
  return (
    <ul className="mt-2 space-y-1.5">
      {reviews.map((r) => {
        const state = REVIEW_STATE[r.state]
        const waiting = r.state !== 'QUERY_RAISED'
        return (
          <li key={r.reviewPublicId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <Badge tone={state.tone}>{state.label}</Badge>
            <span className="font-semibold">{r.reviewType === 'PHARMACY' ? 'Pharmacy' : 'Laboratory'}</span>
            <span className="text-muted">
              {r.reviewerName ?? 'Nobody assigned'}
              {waiting && r.assignedAt && <>, {r.reviewerName ? 'assigned' : 'issued'} {formatRelative(r.assignedAt)}</>}
            </span>
            {canReassign && waiting && (
              <button
                type="button"
                className="font-semibold text-accent-strong underline-offset-2 hover:underline"
                onClick={() => onReassign(r)}
              >
                {r.state === 'UNASSIGNED' ? 'Assign' : 'Reassign'}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function ReleaseDesk() {
  const { can } = useAuth()
  const [status, setStatus] = useState<ReleaseDeskRow['status'] | ''>('')
  const [reassigning, setReassigning] = useState<Reassigning | null>(null)
  const [centreAssigning, setCentreAssigning] = useState<CentreAssigning | null>(null)
  const desk = useQuery({
    queryKey: ['release-desk', status],
    queryFn: () => releaseApi.desk(status || undefined),
    ...LIVE,
    refetchInterval: 20_000,
  })

  const rows = desk.data ?? []
  const ready = rows.filter((r) => r.status === 'READY').length
  const unassigned = rows.reduce((n, r) => n + (r.openReviews ?? []).filter((v) => v.state === 'UNASSIGNED').length, 0)
  const queries = rows.reduce((n, r) => n + (r.openReviews ?? []).filter((v) => v.state === 'QUERY_RAISED').length, 0)
  const canReassign = can('appointment.assign_team')

  return (
    <>
      <PageHeader
        kicker="Hub coordination"
        title="Release desk"
        description="Completed consultations waiting to reach the patient or their centre. Oldest first, because the wait is theirs. Release sends every document at once."
        actions={
          <div className="flex items-center gap-3 text-sm text-muted">
            <span aria-live="polite">
              {desk.isFetching ? 'Updating…' : desk.dataUpdatedAt ? `Updated ${formatTime(new Date(desk.dataUpdatedAt))}` : null}
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => desk.refetch()} disabled={desk.isFetching}>
              <i aria-hidden className="bi bi-arrow-clockwise" /> Refresh
            </button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.label} type="button" role="tab" aria-selected={status === f.value} onClick={() => setStatus(f.value)} className={`btn btn-sm ${status === f.value ? 'btn-primary' : 'btn-secondary'}`}>
            {f.label}
          </button>
        ))}
      </div>
      <Panel bodyClassName="">
        {desk.isLoading && <div className="p-5"><Spinner label="Loading bundles" /></div>}
        {desk.isError && <ErrorState error={desk.error} onRetry={() => desk.refetch()} />}
        {desk.isSuccess && rows.length === 0 && <EmptyState icon="bi-send-check" title="Nothing waiting">Bundles appear here once a consultation note is signed.</EmptyState>}
        {rows.length > 0 && (
          <>
            <p className="border-b border-line px-5 py-3 text-sm text-muted">
              {!status && <>{rows.length} unreleased. {ready} ready now.</>}
              {unassigned > 0 && (
                <span className="font-semibold text-alarm"> {unassigned} review{unassigned === 1 ? ' has' : 's have'} nobody assigned.</span>
              )}
              {queries > 0 && (
                <span className="font-semibold text-gold-700"> {queries} raised a query.</span>
              )}
            </p>
            <div className="overflow-x-auto">
              <table className="table-base min-w-[860px]">
                <thead>
                  <tr><th>Patient</th><th>Consultation</th><th>State</th><th>Waiting on</th><th><span className="sr-only">Open</span></th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.publicId} className="align-top hover:bg-soft/60">
                      <td>
                        <p className="font-bold">{r.patientName}</p>
                        {r.pathway === 'CENTRE' ? (
                          <>
                            <p className="text-xs text-muted">Centre ID {r.ehrNumber}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                              <Badge tone="navy">Centre</Badge>
                              <span className="text-muted">{r.centreName}</span>
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted">EHR {r.ehrNumber}</p>
                        )}
                      </td>
                      <td className="text-sm">
                        {formatDateTime(r.appointmentDate)}
                        <span className="block text-xs text-muted">{r.appointmentReference}{r.doctorName ? `, ${r.doctorName}` : ''}</span>
                      </td>
                      <td><BundleStatusBadge status={r.status} /><span className="mt-1 block text-xs text-muted">opened {formatRelative(r.createdAt)}</span></td>
                      <td className="text-sm">
                        {r.status === 'BLOCKED'
                          ? <span className="text-alarm">{r.blockedReason}</span>
                          : r.outstanding.length
                            ? r.outstanding.map(humanise).join(', ')
                            : <span className="text-muted">Nothing</span>}
                        <OpenReviews
                          reviews={r.openReviews ?? []}
                          canReassign={canReassign}
                          onReassign={(review) =>
                            r.pathway === 'CENTRE'
                              ? setCentreAssigning({
                                  bundlePublicId: r.publicId,
                                  type: review.reviewType,
                                  centreName: r.centreName,
                                  currentName: review.reviewerName,
                                })
                              : setReassigning({ appointmentPublicId: r.appointmentPublicId, role: REVIEW_ROLE[review.reviewType] })
                          }
                        />
                      </td>
                      <td className="text-right">
                        <Link to={`/hub/releases/${encodeURIComponent(r.publicId)}`} className={`btn btn-sm no-underline ${r.status === 'READY' ? 'btn-primary' : 'btn-secondary'}`}>
                          {r.status === 'READY' ? 'Review and release' : 'Open'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {centreAssigning && (
        <CentreReviewerDialog
          bundlePublicId={centreAssigning.bundlePublicId}
          type={centreAssigning.type}
          centreName={centreAssigning.centreName}
          currentName={centreAssigning.currentName}
          onClose={() => setCentreAssigning(null)}
        />
      )}

      {reassigning && (
        <ReassignDialog
          appointmentPublicId={reassigning.appointmentPublicId}
          role={reassigning.role}
          onClose={() => setReassigning(null)}
        />
      )}
    </>
  )
}
