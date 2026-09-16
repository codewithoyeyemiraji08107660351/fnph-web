import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { lifecycleApi, type CancellationRow } from '@/lib/api/endpoints/records'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

function DecideDialog({ row, approve, onClose, onDone }: { row: CancellationRow; approve: boolean; onClose: () => void; onDone: () => void }) {
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const needsNotes = !approve
  return (
    <Dialog open onClose={onClose} busy={busy} title={approve ? `Cancel ${row.appointmentReference}?` : `Refuse the request for ${row.appointmentReference}?`}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Back</button>
        <button type="button" className={`btn ${approve ? 'btn-danger' : 'btn-primary'}`} disabled={busy || (needsNotes && !notes.trim())} onClick={async () => {
          setBusy(true); setError(null)
          try { await lifecycleApi.decide(row.publicId, approve, notes.trim() || undefined); onDone() } catch (err) { setError(toApiError(err).message); setBusy(false) }
        }}>{busy ? <Spinner label="Saving" inverted /> : approve ? 'Cancel the appointment' : 'Refuse'}</button></>}>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <p className="text-sm">
        {approve
          ? 'The appointment is cancelled and its time released. The patient is told the amount paid stays on their account for the next booking.'
          : 'The appointment stands. The patient sees your reason.'}
      </p>
      <TextAreaField wrapperClassName="mt-4" label={needsNotes ? 'Reason the patient will see' : 'Notes (optional)'} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </Dialog>
  )
}

export function Cancellations() {
  const { requestId } = useParams()
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const list = useQuery({ queryKey: ['cancellations'], queryFn: lifecycleApi.cancellations })
  const [deciding, setDeciding] = useState<{ row: CancellationRow; approve: boolean } | null>(null)
  return (
    <>
      <PageHeader kicker="Hub coordination" title="Cancellation requests" description="Patients asking to cancel or move an appointment, oldest first. Short notice is flagged against the configured notice period." />
      <Panel bodyClassName="">
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {list.data?.length === 0 && <EmptyState icon="bi-calendar-x" title="No requests waiting" />}
        <ul className="divide-y divide-line">
          {list.data?.map((r) => (
            <li key={r.publicId} className={`px-5 py-4 ${r.publicId === requestId ? 'bg-accent-soft/60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-bold">{r.patientName} <span className="font-normal text-muted">{r.appointmentReference}, {formatDateTime(r.appointmentDate)} WAT</span></p>
                  <p className="text-xs text-muted">Asked {formatDateTime(r.requestedAt)} by {r.requestedBy}. {r.hoursNotice} hours notice.{r.proposedTime ? ` Would like ${formatDateTime(r.proposedTime)}.` : ''}</p>
                  <p className="mt-1 max-w-2xl">{r.reason}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.requestType === 'CANCEL' ? 'red' : 'gold'}>{humanise(r.requestType)}</Badge>
                  {can('appointment.approve') && (
                    <>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeciding({ row: r, approve: false })}>Refuse</button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setDeciding({ row: r, approve: true })}>{r.requestType === 'CANCEL' ? 'Cancel it' : 'Cancel so they can rebook'}</button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
      {deciding && (
        <DecideDialog row={deciding.row} approve={deciding.approve} onClose={() => setDeciding(null)}
          onDone={() => { toast(deciding.approve ? 'Appointment cancelled. The patient has been told.' : 'Request refused. The patient has been told.'); setDeciding(null); void qc.invalidateQueries({ queryKey: ['cancellations'] }) }} />
      )}
    </>
  )
}
