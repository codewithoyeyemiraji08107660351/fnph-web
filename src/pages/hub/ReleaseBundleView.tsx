import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { releaseApi } from '@/lib/api/endpoints/hub'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, humanise } from '@/lib/format'

import {
  ErrorState,
  PageHeader,
  Panel,
} from '@/components/ui/Page'

import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { TextAreaField } from '@/components/ui/Field'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Dialog } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { BundleStatusBadge } from './ReleaseDesk'
import { ReviewsPanel } from './ReviewsPanel'

function formatOptionalDate(value?: string | null) {
  if (!value) return '—'

  // Backend LocalDate values are YYYY-MM-DD. Display them without
  // converting through JavaScript Date to avoid timezone shifts.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }

  return value
}

function TextBlock({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  if (!value?.trim()) return null

  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <div className="whitespace-pre-wrap rounded-lg border border-line bg-surface px-3 py-3 text-sm leading-6">
        {value}
      </div>
    </div>
  )
}

function ClinicalNoteSection({
  note,
}: {
  note?: {
    clinicalNote?: string | null
    version: number
    signed: boolean
    signedAt?: string | null
    signedBy?: string | null
    followUpRecommendation?: string | null
    followUpTimeline?: string | null
  } | null
}) {
  if (!note) {
    return (
      <Panel title="Clinical note">
        <p className="text-sm text-muted">
          No clinical note was returned for this bundle.
        </p>
      </Panel>
    )
  }

  return (
    <Panel title="Clinical note">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={note.signed ? 'green' : 'gold'}>
            {note.signed ? 'Signed' : 'Not signed'}
          </Badge>

          <Badge tone="navy">
            Version {note.version}
          </Badge>

          {note.signedBy && (
            <span className="text-sm text-muted">
              Signed by {note.signedBy}
            </span>
          )}

          {note.signedAt && (
            <span className="text-sm text-muted">
              {formatDateTime(note.signedAt)}
            </span>
          )}
        </div>

        {note.clinicalNote ? (
          <TextBlock
            label="Clinical note"
            value={note.clinicalNote}
          />
        ) : (
          <p className="text-sm text-muted">
            The clinical note contains no text.
          </p>
        )}

        {(note.followUpRecommendation ||
          note.followUpTimeline) && (
          <div className="rounded-lg border border-line bg-surface-muted p-4">
            <p className="mb-3 font-bold">
              Follow-up recorded in clinical note
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <TextBlock
                label="Recommendation"
                value={note.followUpRecommendation}
              />

              <TextBlock
                label="Timeline"
                value={note.followUpTimeline}
              />
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}

function PrescriptionsSection({
  prescriptions,
}: {
  prescriptions?: Array<{
    publicId: string
    issueNumber?: string | null
    status: string
    notRequired: boolean
    notRequiredReason?: string | null
    issueDate?: string | null
    expiryDate?: string | null
    validityDays?: number | null
    clinicalInformation?: string | null
    items: Array<{
      medication: string
      strength?: string | null
      frequency: string
      duration?: string | null
      instructions?: string | null
      sequence?: number | null
    }>
  }>
}) {
  if (!prescriptions?.length) {
    return (
      <Panel title="Prescriptions">
        <p className="text-sm text-muted">
          No prescription was produced for this bundle.
        </p>
      </Panel>
    )
  }

  return (
    <Panel title="Prescriptions">
      <div className="space-y-5">
        {prescriptions.map((prescription, index) => (
          <section
            key={prescription.publicId}
            className="rounded-xl border border-line"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">
                    Prescription {index + 1}
                  </h3>

                  {prescription.status && (
                    <Badge tone="navy">
                      {humanise(prescription.status)}
                    </Badge>
                  )}

                  {prescription.notRequired && (
                    <Badge>
                      Not required
                    </Badge>
                  )}
                </div>

                {prescription.issueNumber && (
                  <p className="mt-1 text-sm text-muted">
                    Issue number: {prescription.issueNumber}
                  </p>
                )}
              </div>

              <div className="text-right text-sm text-muted">
                <div>
                  Issued: {formatOptionalDate(prescription.issueDate)}
                </div>

                {prescription.expiryDate && (
                  <div>
                    Expires: {formatOptionalDate(prescription.expiryDate)}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5 px-5 py-5">
              {prescription.notRequired &&
                prescription.notRequiredReason && (
                  <Alert tone="warning">
                    {prescription.notRequiredReason}
                  </Alert>
                )}

              <TextBlock
                label="Clinical information"
                value={prescription.clinicalInformation}
              />

              {prescription.items.length > 0 ? (
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
                    Medicines
                  </p>

                  <div className="overflow-x-auto rounded-lg border border-line">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="bg-surface-muted text-left">
                        <tr>
                          <th className="px-3 py-3 font-bold">
                            Medicine
                          </th>
                          <th className="px-3 py-3 font-bold">
                            Strength
                          </th>
                          <th className="px-3 py-3 font-bold">
                            Frequency
                          </th>
                          <th className="px-3 py-3 font-bold">
                            Duration
                          </th>
                          <th className="px-3 py-3 font-bold">
                            Instructions
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-line">
                        {prescription.items.map((item, itemIndex) => (
                          <tr
                            key={`${prescription.publicId}-${item.sequence ?? itemIndex}`}
                          >
                            <td className="px-3 py-3 font-bold">
                              {item.medication}
                            </td>

                            <td className="px-3 py-3">
                              {item.strength || '—'}
                            </td>

                            <td className="px-3 py-3">
                              {item.frequency || '—'}
                            </td>

                            <td className="px-3 py-3">
                              {item.duration || '—'}
                            </td>

                            <td className="px-3 py-3 whitespace-pre-wrap">
                              {item.instructions || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  No medicine items are attached to this prescription.
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  )
}

function InvestigationsSection({
  investigations,
}: {
  investigations?: Array<{
    publicId: string
    issueNumber?: string | null
    status: string
    notRequired: boolean
    notRequiredReason?: string | null
    issueDate?: string | null
    expiryDate?: string | null
    validityDays?: number | null
    clinicalInformation?: string | null
    items: Array<{
      panelName: string
      panelCode?: string | null
      notes?: string | null
      sequence?: number | null
    }>
  }>
}) {
  if (!investigations?.length) {
    return (
      <Panel title="Investigations">
        <p className="text-sm text-muted">
          No investigation request was produced for this bundle.
        </p>
      </Panel>
    )
  }

  return (
    <Panel title="Investigations">
      <div className="space-y-5">
        {investigations.map((investigation, index) => (
          <section
            key={investigation.publicId}
            className="rounded-xl border border-line"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">
                    Investigation {index + 1}
                  </h3>

                  {investigation.status && (
                    <Badge tone="navy">
                      {humanise(investigation.status)}
                    </Badge>
                  )}

                  {investigation.notRequired && (
                    <Badge>
                      Not required
                    </Badge>
                  )}
                </div>

                {investigation.issueNumber && (
                  <p className="mt-1 text-sm text-muted">
                    Issue number: {investigation.issueNumber}
                  </p>
                )}
              </div>

              <div className="text-right text-sm text-muted">
                <div>
                  Issued: {formatOptionalDate(investigation.issueDate)}
                </div>

                {investigation.expiryDate && (
                  <div>
                    Expires: {formatOptionalDate(investigation.expiryDate)}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5 px-5 py-5">
              {investigation.notRequired &&
                investigation.notRequiredReason && (
                  <Alert tone="warning">
                    {investigation.notRequiredReason}
                  </Alert>
                )}

              <TextBlock
                label="Clinical information"
                value={investigation.clinicalInformation}
              />

              {investigation.items.length > 0 ? (
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
                    Investigation panels
                  </p>

                  <div className="space-y-3">
                    {investigation.items.map((item, itemIndex) => (
                      <div
                        key={`${investigation.publicId}-${item.sequence ?? itemIndex}`}
                        className="rounded-lg border border-line p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-bold">
                              {item.panelName}
                            </p>

                            {item.panelCode && (
                              <p className="mt-1 text-xs text-muted">
                                Code: {item.panelCode}
                              </p>
                            )}
                          </div>

                          {item.sequence != null && (
                            <Badge>
                              #{item.sequence}
                            </Badge>
                          )}
                        </div>

                        {item.notes && (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  No investigation panels are attached to this request.
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  )
}

function FollowUpsSection({
  followUps,
}: {
  followUps?: Array<{
    publicId: string
    recommendation?: string | null
    reviewInterval?: string | null
    expectedTimeframe?: string | null
    preferredDate?: string | null
    preferredTime?: string | null
    consultationMode?: string | null
    status: string
    scheduledDate?: string | null
    completedDate?: string | null
    notes?: string | null
  }>
}) {
  if (!followUps?.length) {
    return (
      <Panel title="Follow-up recommendations">
        <p className="text-sm text-muted">
          No separate follow-up recommendation was produced for this bundle.
        </p>
      </Panel>
    )
  }

  return (
    <Panel title="Follow-up recommendations">
      <div className="space-y-4">
        {followUps.map((followUp, index) => (
          <section
            key={followUp.publicId}
            className="rounded-xl border border-line p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold">
                  Recommendation {index + 1}
                </h3>

                {followUp.status && (
                  <Badge tone="navy">
                    {humanise(followUp.status)}
                  </Badge>
                )}
              </div>

              <span className="text-xs text-muted">
                {followUp.publicId}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <TextBlock
                label="Recommendation"
                value={followUp.recommendation}
              />

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <TextBlock
                  label="Review interval"
                  value={followUp.reviewInterval}
                />

                <TextBlock
                  label="Expected timeframe"
                  value={followUp.expectedTimeframe}
                />

                <TextBlock
                  label="Consultation mode"
                  value={
                    followUp.consultationMode
                      ? humanise(followUp.consultationMode)
                      : null
                  }
                />

                <TextBlock
                  label="Preferred date"
                  value={formatOptionalDate(followUp.preferredDate)}
                />

                <TextBlock
                  label="Preferred time"
                  value={followUp.preferredTime}
                />

                <TextBlock
                  label="Scheduled date"
                  value={formatOptionalDate(followUp.scheduledDate)}
                />

                <TextBlock
                  label="Completed date"
                  value={formatOptionalDate(followUp.completedDate)}
                />
              </div>

              <TextBlock
                label="Notes"
                value={followUp.notes}
              />
            </div>
          </section>
        ))}
      </div>
    </Panel>
  )
}

function ClinicalContents({
  bundle,
}: {
  bundle: {
    clinicalNote?: {
      clinicalNote?: string | null
      version: number
      signed: boolean
      signedAt?: string | null
      signedBy?: string | null
      followUpRecommendation?: string | null
      followUpTimeline?: string | null
    } | null
    prescriptions?: Array<{
      publicId: string
      issueNumber?: string | null
      status: string
      notRequired: boolean
      notRequiredReason?: string | null
      issueDate?: string | null
      expiryDate?: string | null
      validityDays?: number | null
      clinicalInformation?: string | null
      items: Array<{
        medication: string
        strength?: string | null
        frequency: string
        duration?: string | null
        instructions?: string | null
        sequence?: number | null
      }>
    }>
    investigations?: Array<{
      publicId: string
      issueNumber?: string | null
      status: string
      notRequired: boolean
      notRequiredReason?: string | null
      issueDate?: string | null
      expiryDate?: string | null
      validityDays?: number | null
      clinicalInformation?: string | null
      items: Array<{
        panelName: string
        panelCode?: string | null
        notes?: string | null
        sequence?: number | null
      }>
    }>
    followUps?: Array<{
      publicId: string
      recommendation?: string | null
      reviewInterval?: string | null
      expectedTimeframe?: string | null
      preferredDate?: string | null
      preferredTime?: string | null
      consultationMode?: string | null
      status: string
      scheduledDate?: string | null
      completedDate?: string | null
      notes?: string | null
    }>
  }
}) {
  const hasClinicalNote = Boolean(bundle.clinicalNote)
  const prescriptionCount = bundle.prescriptions?.length ?? 0
  const investigationCount = bundle.investigations?.length ?? 0
  const followUpCount = bundle.followUps?.length ?? 0

  const hasClinicalData =
    hasClinicalNote ||
    prescriptionCount > 0 ||
    investigationCount > 0 ||
    followUpCount > 0

  return (
    <div className="mt-5 space-y-5">
      <div>
        <h2 className="text-xl font-black">
          Clinical contents
        </h2>

        <p className="mt-1 text-sm text-muted">
          Read-only clinical information produced during this consultation.
          The Hub Coordinator can inspect it but cannot change it here.
        </p>
      </div>

      {!hasClinicalData && (
        <Alert tone="warning">
          No clinical content was returned for this bundle.
          Check the bundle components and backend response if documents were
          expected.
        </Alert>
      )}

      <ClinicalNoteSection note={bundle.clinicalNote} />

      <PrescriptionsSection
        prescriptions={bundle.prescriptions}
      />

      <InvestigationsSection
        investigations={bundle.investigations}
      />

      <FollowUpsSection
        followUps={bundle.followUps}
      />
    </div>
  )
}

export function ReleaseBundleView() {
  const { bundleId = '' } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()

  const bundle = useQuery({
    queryKey: ['bundle', bundleId],
    queryFn: () => releaseApi.get(bundleId),
    enabled: Boolean(bundleId),
  })

  const [notes, setNotes] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (bundle.isLoading) {
    return <Spinner label="Loading bundle" />
  }

  if (bundle.isError || !bundle.data) {
    return (
      <ErrorState
        error={bundle.error}
        onRetry={() => bundle.refetch()}
      />
    )
  }

  const b = bundle.data

  const outstanding = b.components.filter(
    (component) => component.outstanding,
  )

  const released = b.status === 'RELEASED'

  const update = (next: typeof b) => {
    qc.setQueryData(['bundle', bundleId], next)
    void qc.invalidateQueries({
      queryKey: ['release-desk'],
    })
  }

  const release = async () => {
    setBusy(true)
    setError(null)

    try {
      update(
        await releaseApi.release(
          b.publicId,
          notes.trim() || undefined,
        ),
      )

      toast('Released. The patient has been notified.')
      setConfirming(false)
    } catch (err) {
      setError(toApiError(err).message)
      setConfirming(false)
      void bundle.refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Link
        to="/hub/releases"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold no-underline"
      >
        <i
          aria-hidden
          className="bi bi-arrow-left"
        />
        Release desk
      </Link>

      <PageHeader
        kicker="Release bundle"
        title="Review and release"
        actions={
          <BundleStatusBadge status={b.status} />
        }
      />

      {error && (
        <Alert
          tone="danger"
          className="mb-5"
        >
          {error}
        </Alert>
      )}

      {b.status === 'BLOCKED' &&
        b.blockedReason && (
          <Alert
            tone="danger"
            className="mb-5"
            title="Blocked"
          >
            {b.blockedReason}
          </Alert>
        )}

      {released && (
        <Alert
          tone="success"
          className="mb-5"
          title="Released"
        >
          By {b.releasedBy || 'staff'} on{' '}
          {b.releasedAt
            ? formatDateTime(b.releasedAt)
            : 'an unknown date'}
          .
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel
          title="Components"
          bodyClassName=""
        >
          <ul className="divide-y divide-line">
            {b.components.map((component) => (
              <li
                key={component.componentType}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-bold">
                    {humanise(component.componentType)}
                  </p>

                  {component.notRequired && (
                    <p className="text-sm text-muted">
                      Doctor recorded this as not needed:{' '}
                      {component.notRequiredReason ??
                        'no reason given'}
                    </p>
                  )}
                </div>

                {component.complete ? (
                  <Badge tone="green">
                    Done
                  </Badge>
                ) : component.notRequired ? (
                  <Badge>
                    Not required
                  </Badge>
                ) : component.outstanding ? (
                  <Badge tone="gold">
                    Outstanding
                  </Badge>
                ) : (
                  <Badge tone="navy">
                    In progress
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        {!released && (
          <Panel title="Decision">
            <p className="text-sm text-muted">
              This is an administrative check: every component is
              done or recorded as not needed. It is not a clinical
              review, and nothing here changes the documents.
            </p>

            {outstanding.length > 0 && (
              <Alert
                tone="warning"
                className="mt-4"
              >
                Still waiting on{' '}
                {outstanding
                  .map((component) =>
                    humanise(component.componentType),
                  )
                  .join(', ')}
                . Chase the named reviewer, or block with a reason.
              </Alert>
            )}

            <TextAreaField
              wrapperClassName="mt-4"
              label="Release notes (optional)"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {can('release_bundle.release') && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      busy ||
                      outstanding.length > 0
                    }
                    onClick={() =>
                      setConfirming(true)
                    }
                  >
                    {b.status === 'BLOCKED'
                      ? 'Lift the block and release'
                      : 'Release everything'}
                  </button>

                  {b.status !== 'BLOCKED' && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() =>
                        setBlocking(true)
                      }
                    >
                      Block
                    </button>
                  )}
                </>
              )}
            </div>
          </Panel>
        )}
      </div>

      {b.appointmentPublicId && (
        <ReviewsPanel appointmentPublicId={b.appointmentPublicId} />
      )}

      <ClinicalContents bundle={b.clinicalContent} />

      {confirming && (
        <Dialog
          open
          onClose={() =>
            setConfirming(false)
          }
          busy={busy}
          title="Release to the patient?"
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setConfirming(false)
                }
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={release}
                disabled={busy}
              >
                {busy ? (
                  <Spinner
                    label="Releasing"
                    inverted
                  />
                ) : (
                  'Release now'
                )}
              </button>
            </>
          }
        >
          {b.status === 'BLOCKED' &&
            b.blockedReason && (
              <Alert
                tone="warning"
                className="mb-3"
              >
                It was blocked because:{' '}
                {b.blockedReason}. Confirm that concern
                is resolved.
              </Alert>
            )}

          <p className="text-sm">
            Every document in this bundle becomes
            available to the patient at once, and they
            are notified. A released bundle cannot be
            withdrawn; a correction needs a superseding
            document from the doctor.
          </p>
        </Dialog>
      )}

      {blocking && (
        <ReasonDialog
          title="Block this bundle"
          description="Nothing reaches the patient while it is blocked. Say what is wrong, for whoever picks this up next."
          label="Reason"
          placeholder="Pharmacist raised a dose query. Holding for the multidisciplinary team."
          confirmLabel="Block"
          danger
          onClose={() =>
            setBlocking(false)
          }
          onConfirm={async (reason) => {
            try {
              update(
                await releaseApi.block(
                  b.publicId,
                  reason,
                ),
              )

              toast('Bundle blocked.')
              setBlocking(false)
            } catch (err) {
              setError(
                toApiError(err).message,
              )
              setBlocking(false)
              void bundle.refetch()
            }
          }}
        />
      )}
    </>
  )
}
