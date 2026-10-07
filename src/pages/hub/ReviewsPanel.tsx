import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { oversightApi } from '@/lib/api/endpoints/hub'
import { toApiError } from '@/lib/api/http'
import type { HubReviewRow, HubReviewState } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime } from '@/lib/format'

import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { ReasonField, TextAreaField } from '@/components/ui/Field'
import { EmptyState, ErrorState, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

import { oversightKeys, REASON_MIN, useRefreshOversight } from './oversight'

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

function EditReviewDialog({
  appointmentPublicId,
  review,
  onClose,
}: {
  appointmentPublicId: string
  review: HubReviewRow
  onClose: () => void
}) {
  const toast = useToast()
  const refresh = useRefreshOversight(appointmentPublicId)
  const [notes, setNotes] = useState(review.notes ?? '')
  const [queryDetail, setQueryDetail] = useState(review.queryDetail ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unchanged =
    notes.trim() === (review.notes ?? '').trim() &&
    queryDetail.trim() === (review.queryDetail ?? '').trim()
  const reasonShort = reason.trim().length < REASON_MIN

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await oversightApi.editReview(appointmentPublicId, review.reviewPublicId, {
        notes: notes.trim() || null,
        queryDetail: review.queryRaised ? queryDetail.trim() || null : null,
        reason: reason.trim(),
        expectedUpdatedAt: review.updatedAt ?? null,
      })
      await refresh()
      toast('Review updated. The reviewer has been notified.')
      onClose()
    } catch (e) {
      const apiError = toApiError(e)
      setError(apiError.message)
      // 409: someone changed it. Pull the latest so a retry starts from it.
      if (apiError.status === 409) await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      size="lg"
      title={`Edit ${TYPE_LABEL[review.reviewType].toLowerCase()} review`}
      description={`${review.reviewerName ?? 'The reviewer'} is notified with your reason. The previous text is kept in the edit history. The outcome stays theirs.`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={busy || unchanged || reasonShort}
          >
            {busy ? 'Saving' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <TextAreaField
          label="Reviewer notes"
          rows={6}
          maxLength={10000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {review.queryRaised && (
          <TextAreaField
            label="Query"
            rows={3}
            maxLength={10000}
            value={queryDetail}
            onChange={(e) => setQueryDetail(e.target.value)}
          />
        )}
        <ReasonField
          value={reason}
          onChange={setReason}
          min={REASON_MIN}
          placeholder="Reviewer confirmed by phone that the dose note referred to the morning tablet."
        />
      </div>
    </Dialog>
  )
}

function ReviewItem({
  review,
  canEdit,
  onEdit,
}: {
  review: HubReviewRow
  canEdit: boolean
  onEdit: () => void
}) {
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
        <div className="flex flex-wrap items-center gap-2">
          <OutcomeBadge outcome={review.outcome} />
          <StateBadge state={review.state} />
          {canEdit && review.state === 'SUBMITTED' && (
            <button type="button" className="btn btn-quiet btn-sm" onClick={onEdit}>
              <i aria-hidden className="bi bi-pencil" /> Edit
            </button>
          )}
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
 * Every pharmacy and laboratory review on one consultation. A coordinator
 * holding hub.clinical_edit can correct a submitted review's notes.
 */
export function ReviewsPanel({ appointmentPublicId }: { appointmentPublicId: string }) {
  const { can } = useAuth()
  const [editing, setEditing] = useState<HubReviewRow | null>(null)
  const reviews = useQuery({
    queryKey: oversightKeys.reviews(appointmentPublicId),
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
            <ReviewItem
              key={review.reviewPublicId}
              review={review}
              canEdit={can('hub.clinical_edit')}
              onEdit={() => setEditing(review)}
            />
          ))}
        </ul>
      )}

      {editing && (
        <EditReviewDialog
          appointmentPublicId={appointmentPublicId}
          review={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Panel>
  )
}
