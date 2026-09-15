import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { reviewApi, type ReviewKind } from '@/lib/api/endpoints/clinical'
import { toApiError } from '@/lib/api/http'
import type { InvestigationDetail, PrescriptionDetail, ReviewRow } from '@/lib/api/types'
import { formatCalendarDate, formatDateTime, formatRelative } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { TextAreaField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

function DocumentDetail({ row }: { row: ReviewRow }) {
  const id = row.documentPublicId ?? ''
  const isRx = row.documentType === 'PRESCRIPTION'
  const detail = useQuery<PrescriptionDetail | InvestigationDetail>({
    queryKey: ['review-document', id],
    queryFn: (): Promise<PrescriptionDetail | InvestigationDetail> => (isRx ? reviewApi.prescription(id) : reviewApi.investigation(id)),
    enabled: Boolean(id),
  })
  if (!id) return <Alert tone="warning">This review does not name its document. The server needs the review-queue update before the items can be shown.</Alert>
  if (detail.isLoading) return <Spinner label="Loading the document" />
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
  const d = detail.data!
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {d.issueNumber}. Issued {formatCalendarDate(d.issueDate)}
        {d.expiryDate ? `, valid until ${formatCalendarDate(d.expiryDate)}` : ''}.
      </p>
      <div>
        <p className="field-label">Information from the doctor</p>
        <p className="rounded-[12px] bg-canvas px-3 py-2 text-sm whitespace-pre-line">{d.clinicalInformation || 'None given.'}</p>
      </div>
      <div className="overflow-x-auto">
        {'items' in d ? (
          <table className="table-base min-w-[560px]">
            <thead><tr><th>Medicine</th><th>Strength</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
            <tbody>
              {d.items.map((i, n) => (
                <tr key={n}>
                  <td className="font-bold">{i.medication}</td>
                  <td>{i.strength}</td>
                  <td>{i.frequency}</td>
                  <td>{i.duration}</td>
                  <td className="text-muted">{i.instructions && i.instructions !== 'null' ? i.instructions : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="table-base min-w-[360px]">
            <thead><tr><th>Panel</th><th>Code</th></tr></thead>
            <tbody>
              {d.panels.map((p, n) => (
                <tr key={n}><td className="font-bold">{p.panelName}</td><td>{p.panelCode && p.panelCode !== 'null' ? p.panelCode : ''}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SubmitForm({ row, onDone }: { row: ReviewRow; onDone: () => void }) {
  const toast = useToast()
  const [outcome, setOutcome] = useState<'VERIFIED' | 'QUERY_RAISED' | ''>('')
  const [notes, setNotes] = useState('')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const query = outcome === 'QUERY_RAISED'
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await reviewApi.submit(row.publicId, { outcome: outcome as 'VERIFIED' | 'QUERY_RAISED', notes: notes.trim() || undefined, queryDetail: query ? detail.trim() : undefined })
      toast(query ? 'Submitted with a query. The Hub Coordinator has it.' : 'Verified and sent to the Hub Coordinator.')
      onDone()
    } catch (err) {
      setError(toApiError(err).message)
      setBusy(false)
    }
  }
  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <fieldset>
        <legend className="field-label">Outcome</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['VERIFIED', 'Verified', 'Transcribed to the offline EHR and checked. Nothing to raise.'],
            ['QUERY_RAISED', 'Raise a query', 'I have a concern the team needs to see.'],
          ] as const).map(([value, label, hint]) => (
            <label key={value} className={`cursor-pointer rounded-[14px] border p-3 ${outcome === value ? 'border-accent bg-accent-soft' : 'border-line'}`}>
              <input type="radio" name={`outcome-${row.publicId}`} className="sr-only" checked={outcome === value} onChange={() => setOutcome(value)} />
              <span className="block text-sm font-bold">{label}</span>
              <span className="block text-xs text-muted">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <TextAreaField label="Review notes (optional)" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Transcribed to the offline EHR. Doses and interactions checked." />
      {query && (
        <>
          <TextAreaField label="Describe the concern" rows={3} maxLength={2000} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Dose is above the usual maximum for this patient. Requesting confirmation before dispensing." />
          <Alert tone="warning">A query does not send this back to the doctor. The document still goes to the Hub Coordinator, who takes the concern to the team. If it must change, the doctor issues a new document.</Alert>
        </>
      )}
      <button type="button" className="btn btn-primary" disabled={busy || !outcome || (query && !detail.trim())} onClick={submit}>
        {busy ? <Spinner label="Submitting" inverted /> : 'Submit review'}
      </button>
    </div>
  )
}

export function ReviewQueue({ kind }: { kind: ReviewKind }) {
  const qc = useQueryClient()
  const toast = useToast()
  const queue = useQuery({ queryKey: ['review-queue', kind], queryFn: () => reviewApi.queue(kind), refetchInterval: 60_000 })
  const [active, setActive] = useState<string | null>(null)
  const title = kind === 'pharmacy' ? 'Prescriptions to review' : 'Investigation requests to review'
  const refresh = () => qc.invalidateQueries({ queryKey: ['review-queue', kind] })

  const openRow = async (row: ReviewRow) => {
    if (active === row.publicId) return setActive(null)
    setActive(row.publicId)
    if (!row.openedAt) {
      try {
        await reviewApi.open(row.publicId)
        void refresh()
      } catch (err) {
        toast(toApiError(err).message, 'error')
      }
    }
  }

  return (
    <>
      <PageHeader
        kicker="Professional review"
        title={title}
        description="Assigned to you by the Hub Coordinator. Reviews go forward only: a concern is recorded for the team and the document still moves on. The consultation note is not part of a review."
      />
      <Panel bodyClassName="">
        {queue.isLoading && <div className="p-5"><Spinner label="Loading reviews" /></div>}
        {queue.isError && <ErrorState error={queue.error} onRetry={() => queue.refetch()} />}
        {queue.data?.length === 0 && <EmptyState icon="bi-clipboard-check" title="Nothing to review">Documents from consultations you are assigned to appear here once the doctor issues them.</EmptyState>}
        <ul className="divide-y divide-line">
          {queue.data?.map((r) => (
            <li key={r.publicId}>
              <button type="button" onClick={() => openRow(r)} aria-expanded={active === r.publicId} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-soft/60">
                <span>
                  <span className="block font-bold">{r.issueNumber ?? r.documentType}</span>
                  <span className="block text-xs text-muted">Assigned {formatDateTime(r.assignedAt)} ({formatRelative(r.assignedAt)})</span>
                </span>
                <span className="flex items-center gap-2">
                  {r.openedAt ? <Badge tone="navy">Opened</Badge> : <Badge tone="gold">New</Badge>}
                  <i aria-hidden className={`bi ${active === r.publicId ? 'bi-chevron-up' : 'bi-chevron-down'} text-muted`} />
                </span>
              </button>
              {active === r.publicId && (
                <div className="grid gap-6 border-t border-line bg-canvas/50 px-5 py-5 lg:grid-cols-[1.3fr_1fr]">
                  <DocumentDetail row={r} />
                  <SubmitForm row={r} onDone={() => { setActive(null); void refresh() }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
