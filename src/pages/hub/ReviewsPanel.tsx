import { useQuery } from '@tanstack/react-query'

import { oversightApi } from '@/lib/api/endpoints/hub'
import type { HubReviewRow, HubReviewState } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'

import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'

const TYPE_LABEL: Record<HubReviewRow['reviewType'], string> = {
  PHARMACY: 'Pharmacy',
  LABORATORY: 'Laboratory',
}

const DOCUMENT_LABEL: Record<HubReviewRow['reviewType'], string> = {
  PHARMACY: 'Prescription',
  LABORATORY: 'Investigation',
}

function StateBadge({ state }: { state: HubReviewState }) {
  switch (state) {
    case 'SUBMITTED':
      return <Badge tone="green">Submitted</Badge>
    case 'IN_REVIEW':
      return <Badge tone="navy">In review</Badge>
    case 'NOT_OPENED':
      return <Badge tone="gold">Not opened</Badge>
    case 'UNASSIGNED':
      return <Badge tone="red">No reviewer</Badge>
  }
}

function OutcomeBadge({ outcome }: { outcome: HubReviewRow['outcome'] }) {
  if (outcome === 'VERIFIED') return <Badge tone="green">Verified</Badge>
  if (outcome === 'QUERY_RAISED') return <Badge tone="gold">Query raised</Badge>
  return null
}

function Milestones({ review }: { review: HubReviewRow }) {
  const steps: Array<[string, string | null | undefined]> = [
    ['Assigned', review.assignedAt],
    ['Opened', review.openedAt],
    ['Submitted', review.submittedAt],
    ['Sent to hub', review.submittedToHubAt],
  ]

  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
      {steps.map(([label, value]) => (
        <div key={label}>
          <dt className="font-bold uppercase tracking-wide text-muted">{label}</dt>
          <dd className={value ? '' : 'text-muted'}>{formatDateTime(value, 'Not yet')}</dd>
        </div>
      ))}
    </dl>
  )
}

function ReviewItem({ review }: { review: HubReviewRow }) {
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold">
            {TYPE_LABEL[review.reviewType]} review
            <span className="ml-2 text-sm font-normal text-muted">
              {DOCUMENT_LABEL[review.reviewType]} {review.documentIssueNumber ?? '(not yet numbered)'}
            </span>
          </p>
          <p className="text-sm text-muted">
            {review.reviewerName ?? 'Nobody assigned'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OutcomeBadge outcome={review.outcome} />
          <StateBadge state={review.state} />
        </div>
      </div>

      {review.state === 'UNASSIGNED' && (
        <Alert tone="warning" className="mt-3">
          Nobody is assigned to this review, so the bundle cannot complete. Assign a{' '}
          {review.reviewType === 'PHARMACY' ? 'pharmacist' : 'laboratory technician'} on the
          appointment's team.
        </Alert>
      )}

      {review.queryRaised && review.queryDetail?.trim() && (
        <Alert tone="warning" title="Query for the hub" className="mt-3">
          <span className="whitespace-pre-wrap">{review.queryDetail}</span>
        </Alert>
      )}

      {review.notes?.trim() ? (
        <div className="mt-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Reviewer notes</p>
          <div className="whitespace-pre-wrap rounded-lg border border-line bg-surface px-3 py-3 text-sm leading-6">
            {review.notes}
          </div>
        </div>
      ) : (
        review.state === 'SUBMITTED' && (
          <p className="mt-3 text-sm text-muted">Submitted without notes.</p>
        )
      )}

      <Milestones review={review} />
    </li>
  )
}

/**
 * Every pharmacy and laboratory review on one consultation, read-only.
 * Editing arrives with versioned history in a later step.
 */
export function ReviewsPanel({ appointmentPublicId }: { appointmentPublicId: string }) {
  const reviews = useQuery({
    queryKey: ['hub-reviews', appointmentPublicId],
    queryFn: () => oversightApi.reviews(appointmentPublicId),
  })

  const count = reviews.data?.length ?? 0

  return (
    <Panel
      title="Pharmacy and laboratory reviews"
      action={count > 0 ? <span className="text-sm text-muted">{count}</span> : undefined}
      className="mt-5"
      bodyClassName=""
    >
      {reviews.isLoading && (
        <div className="p-5">
          <Spinner label="Loading reviews" />
        </div>
      )}

      {reviews.isError && <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />}

      {reviews.isSuccess && count === 0 && (
        <EmptyState icon="bi-clipboard2-check" title="No reviews on this consultation">
          Reviews appear here once the doctor issues a prescription or investigation request.
        </EmptyState>
      )}

      {count > 0 && (
        <ul className="divide-y divide-line">
          {reviews.data!.map((review) => (
            <ReviewItem key={review.reviewPublicId} review={review} />
          ))}
        </ul>
      )}
    </Panel>
  )
}
