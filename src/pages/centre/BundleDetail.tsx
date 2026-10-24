import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { centreApi } from '@/lib/api/endpoints/centre'
import { documentsApi } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import type { CentreBundleDocument, CentreCapability } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime } from '@/lib/format'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { ClinicalContents } from '@/pages/hub/ReleaseBundleView'

const SERVICE_LABEL: Record<CentreCapability, string> = {
  COORDINATION: 'Coordinator',
  PHARMACY: 'Pharmacy',
  LABORATORY: 'Laboratory',
  HIM: 'Records',
}

const DOC_LABEL: Record<CentreBundleDocument['documentType'], string> = {
  PRESCRIPTION: 'Prescription',
  INVESTIGATION_REQUEST: 'Investigation request',
  CLINICAL_SUMMARY: 'Clinical summary',
  FOLLOW_UP_RECOMMENDATION: 'Follow-up recommendation',
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * One care bundle FNPH delivered to this centre: what was prescribed and
 * requested, the follow-up plan, and the documents to print.
 *
 * Opening it records the first open, so FNPH can tell a bundle that arrived
 * from one somebody has looked at.
 */
export function BundleDetail() {
  const { receiptId = '' } = useParams()
  const location = useLocation()
  const state = location.state as { from?: string; capability?: CentreCapability } | null
  const back = state?.from ?? '/centre/incoming'
  const { can, hasRole } = useAuth()
  // The service this person records for: the list they came from, or their role.
  const capability: CentreCapability = state?.capability
    ?? (hasRole('CENTRE_HUB_COORDINATOR', 'CENTRE_ASSISTANT_COORDINATOR') ? 'COORDINATION'
      : hasRole('CENTRE_PHARMACY') ? 'PHARMACY'
        : hasRole('CENTRE_LABORATORY') ? 'LABORATORY'
          : hasRole('CENTRE_HIM') ? 'HIM' : 'COORDINATION')
  const qc = useQueryClient()
  const toast = useToast()
  const [treating, setTreating] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const detail = useQuery({
    queryKey: ['centre-bundle', receiptId],
    queryFn: () => centreApi.incomingItem(receiptId),
    enabled: Boolean(receiptId),
  })

  // The first open changes the list's "not opened" marker.
  const opened = detail.data?.firstOpenedAt
  useEffect(() => {
    if (opened) void qc.invalidateQueries({ queryKey: ['centre-bundles'] })
  }, [opened, qc])

  if (detail.isLoading) return <Spinner label="Loading care bundle" />
  if (detail.isError || !detail.data) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />

  const b = detail.data
  const own = b.actions?.find((a) => a.capability === capability)
  const treated = capability === 'COORDINATION' ? Boolean(b.treatedAt) : Boolean(own)

  const download = async (d: CentreBundleDocument) => {
    setDownloading(d.publicId)
    setError(null)
    try {
      const { blob, filename } = await documentsApi.downloadFile(d.publicId)
      saveBlob(blob, filename)
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setDownloading(null)
      void detail.refetch()
    }
  }

  return (
    <>
      <Link to={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold no-underline">
        <i aria-hidden className="bi bi-arrow-left" /> Care bundles
      </Link>

      <PageHeader
        kicker="Care bundle"
        title={b.patientName}
        description={
          <>
            {b.centrePatientId && <>Centre ID {b.centrePatientId}. </>}
            Consultation {b.appointmentReference}
            {b.appointmentDate && <> on {formatDateTime(b.appointmentDate)}</>}
            {b.doctorName && <> with {b.doctorName}</>}. Released {formatDateTime(b.releasedAt ?? b.deliveredAt)}.
          </>
        }
        actions={treated ? <Badge tone="green">Done by {SERVICE_LABEL[capability].toLowerCase()}</Badge> : <Badge tone="gold">To act on</Badge>}
      />

      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

      {(b.actions?.length ?? 0) > 0 && (
        <Panel title="What the centre has done" className="mb-5" bodyClassName="">
          <ul className="divide-y divide-line">
            {b.actions.map((a) => (
              <li key={a.capability} className="px-5 py-3 text-sm">
                <p className="font-bold">{SERVICE_LABEL[a.capability]} <span className="font-normal text-muted">{formatDateTime(a.actedAt)}, {a.actedBy}</span></p>
                <p className="mt-0.5 whitespace-pre-line">{a.notes}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Documents"
        bodyClassName=""
        action={!treated && can('centre_bundle.mark_treated') ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setTreating(true)}>Mark treated</button>
        ) : undefined}
      >
        {b.documents.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No documents for your role in this bundle.</p>
        ) : (
          <ul className="divide-y divide-line">
            {b.documents.map((d) => {
              const usable = d.status === 'ACTIVE' && d.downloadCount < d.maxDownloads
              return (
                <li key={d.publicId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="text-sm">
                    <p className="font-bold">{DOC_LABEL[d.documentType] ?? d.documentType} <span className="font-normal text-muted">{d.issueNumber}</span></p>
                    <p className="text-muted">
                      {d.status === 'ACTIVE'
                        ? <>Valid until {formatDateTime(d.expiresAt)}. {d.downloadCount} of {d.maxDownloads} downloads used.</>
                        : d.status === 'EXPIRED' ? 'Expired.' : d.status === 'REVOKED' ? 'Withdrawn by FNPH.' : d.status}
                    </p>
                  </div>
                  {can('document.download') && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!usable || downloading !== null}
                      onClick={() => void download(d)}
                    >
                      {downloading === d.publicId ? <Spinner label="Downloading" /> : <><i aria-hidden className="bi bi-download" /> Download PDF</>}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <ClinicalContents
        bundle={b}
        heading="What FNPH released"
        intro="Read-only. Each section shows what your role needs to act on. Contact the FNPH hub if anything looks wrong."
      />

      {treating && (
        <ReasonDialog
          title={`Mark treated (${SERVICE_LABEL[capability].toLowerCase()}): ${b.patientName}`}
          description="Record what the centre did with this bundle. It moves to the treated list."
          label="What was done"
          placeholder="Medication dispensed at the centre pharmacy. Follow-up booked for six weeks."
          confirmLabel="Mark treated"
          min={5}
          onClose={() => setTreating(false)}
          onConfirm={async (notes) => {
            await centreApi.markTreated(b.publicId, notes, capability)
            toast('Marked treated.')
            setTreating(false)
            await Promise.all([
              qc.invalidateQueries({ queryKey: ['centre-bundles'] }),
              qc.invalidateQueries({ queryKey: ['centre-bundle', receiptId] }),
              qc.invalidateQueries({ queryKey: ['centre-me'] }),
            ])
          }}
        />
      )}
    </>
  )
}
