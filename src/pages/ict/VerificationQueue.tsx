import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ictApi, type VerificationRequest, type VerificationStatus } from '@/lib/api/endpoints/operations'
import { patientRecordsApi } from '@/lib/api/endpoints/records'
import { useAuth } from '@/lib/auth/AuthProvider'
import { toApiError } from '@/lib/api/http'
import { formatCalendarDate, formatDateTime, formatPhone, humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const FILTERS: Array<VerificationStatus | ''> = ['SUBMITTED', 'WITH_HIM', 'WITH_ICT', '']

function CreateRecordDialog({ req, onClose, onDone }: { req: VerificationRequest; onClose: () => void; onDone: (patientId: string) => void }) {
  const [f, setF] = useState({ ehrNumber: req.ehrNumberClaimed, firstName: req.fullName.split(' ')[0] ?? '', lastName: req.fullName.split(' ').slice(1).join(' '), dateOfBirth: req.dateOfBirth ?? '', phoneNumber: req.phoneNumber ?? '', email: '', verifiedHow: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ok = f.ehrNumber.trim() && f.firstName.trim() && f.lastName.trim() && f.dateOfBirth && f.verifiedHow.trim().length >= 10
  return (
    <Dialog open size="lg" onClose={onClose} busy={busy} title={`Create a record for ${req.fullName}`}
      description="Only after checking the paper record. This bypasses every automatic check, so say exactly how the person was verified. The record starts inactive."
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={busy || !ok} onClick={async () => {
          setBusy(true); setError(null)
          try {
            const r = await patientRecordsApi.createManual({ ehrNumber: f.ehrNumber.trim(), firstName: f.firstName.trim(), lastName: f.lastName.trim(), dateOfBirth: f.dateOfBirth, phoneNumber: f.phoneNumber.trim() || undefined, email: f.email.trim() || undefined, verificationRequestPublicId: req.publicId, verifiedHow: f.verifiedHow.trim() })
            onDone(r.publicId)
          } catch (err) { setError(toApiError(err).message); setBusy(false) }
        }}>{busy ? <Spinner label="Creating" inverted /> : 'Create record'}</button></>}>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Hospital (EHR) number" value={f.ehrNumber} onChange={(e) => setF({ ...f, ehrNumber: e.target.value })} />
        <TextField label="Date of birth" type="date" value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} />
        <TextField label="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
        <TextField label="Last name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
        <TextField label="Phone" type="tel" value={f.phoneNumber} onChange={(e) => setF({ ...f, phoneNumber: e.target.value })} />
        <TextField label="Email (needed to send the setup link)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <TextAreaField wrapperClassName="sm:col-span-2" label="How was this person verified?" rows={2} value={f.verifiedHow} onChange={(e) => setF({ ...f, verifiedHow: e.target.value })}
          placeholder="Paper record 301122 pulled by HIM; identity checked against national ID at the records desk on 15 September." />
      </div>
    </Dialog>
  )
}

function ResolveDialog({ req, initialPatient, onClose, onDone }: { req: VerificationRequest; initialPatient?: string; onClose: () => void; onDone: () => void }) {
  const [outcome, setOutcome] = useState<'RESOLVED' | 'REJECTED'>('RESOLVED')
  const [notes, setNotes] = useState('')
  const [patient, setPatient] = useState(initialPatient ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog open onClose={onClose} busy={busy} title={`Close the request from ${req.fullName}`}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={busy || notes.trim().length < 5} onClick={async () => {
          setBusy(true); setError(null)
          try { await ictApi.resolveVerification(req.publicId, outcome, notes.trim(), patient.trim() || undefined); onDone() } catch (err) { setError(toApiError(err).message); setBusy(false) }
        }}>{busy ? <Spinner label="Saving" inverted /> : 'Close request'}</button></>}>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <SelectField label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as 'RESOLVED' | 'REJECTED')}>
        <option value="RESOLVED">Resolved: the person is a patient and has been helped</option>
        <option value="REJECTED">Not a match: no record for this person</option>
      </SelectField>
      <TextAreaField wrapperClassName="mt-4" label="What was checked and done" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Record found under an older phone number. Patient called on 0803..., details updated." />
      {outcome === 'RESOLVED' && <TextField wrapperClassName="mt-4" label="Patient record id, if one was created (optional)" value={patient} onChange={(e) => setPatient(e.target.value)} />}
    </Dialog>
  )
}

export function VerificationQueue() {
  const qc = useQueryClient()
  const toast = useToast()
  const [status, setStatus] = useState<VerificationStatus | ''>('SUBMITTED')
  const list = useQuery({ queryKey: ['verification', status], queryFn: () => ictApi.verificationQueue(status || undefined) })
  const [resolving, setResolving] = useState<{ req: VerificationRequest; patientId?: string } | null>(null)
  const [creating, setCreating] = useState<VerificationRequest | null>(null)
  const { can } = useAuth()
  const refresh = () => qc.invalidateQueries({ queryKey: ['verification'] })
  return (
    <>
      <PageHeader kicker="Hospital records" title="Enrolment checks" description="People whose details did not match the active hospital export. Each is a real person asking for access; contact them the way they asked." />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => <button key={f || 'all'} type="button" aria-pressed={status === f} onClick={() => setStatus(f)} className={`btn btn-sm ${status === f ? 'btn-primary' : 'btn-secondary'}`}>{f ? humanise(f) : 'All'}</button>)}
      </div>
      <Panel bodyClassName="">
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {list.data?.content.length === 0 && <EmptyState icon="bi-person-check" title="Nothing waiting" />}
        <ul className="divide-y divide-line">
          {list.data?.content.map((r) => (
            <li key={r.publicId} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="font-bold">{r.fullName} <span className="font-normal text-muted">claims EHR {r.ehrNumberClaimed}</span></p>
                  <p className="text-xs text-muted">
                    {r.dateOfBirth ? `Born ${formatCalendarDate(r.dateOfBirth)}. ` : ''}{r.phoneNumber ? `${formatPhone(r.phoneNumber)}. ` : ''}Prefers {humanise(r.preferredContact ?? 'any')}. Asked {formatDateTime(r.submittedAt)}.
                  </p>
                  {r.supportingNote && <p className="mt-1 max-w-2xl">{r.supportingNote}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.status === 'SUBMITTED' ? 'gold' : r.status === 'RESOLVED' ? 'green' : r.status === 'REJECTED' ? 'red' : 'navy'}>{humanise(r.status)}</Badge>
                  {(r.status === 'SUBMITTED' || r.status === 'WITH_ICT') && <button type="button" className="btn btn-quiet btn-sm" onClick={async () => { await ictApi.assignVerification(r.publicId, 'WITH_HIM'); toast('Passed to records.'); await refresh() }}>To records</button>}
                  {(r.status === 'SUBMITTED' || r.status === 'WITH_HIM') && <button type="button" className="btn btn-quiet btn-sm" onClick={async () => { await ictApi.assignVerification(r.publicId, 'WITH_ICT'); toast('Passed to ICT.'); await refresh() }}>To ICT</button>}
                  {r.status !== 'RESOLVED' && r.status !== 'REJECTED' && can('patient.create') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCreating(r)}>Create record</button>}
                  {r.status !== 'RESOLVED' && r.status !== 'REJECTED' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setResolving({ req: r })}>Close</button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
      {creating && (
        <CreateRecordDialog req={creating} onClose={() => setCreating(null)}
          onDone={(patientId) => { toast('Record created. Record the eligibility check and create the account from Patients, then close this request.'); setResolving({ req: creating, patientId }); setCreating(null) }} />
      )}
      {resolving && <ResolveDialog req={resolving.req} initialPatient={resolving.patientId} onClose={() => setResolving(null)} onDone={() => { setResolving(null); toast('Request closed.'); void refresh() }} />}
    </>
  )
}
