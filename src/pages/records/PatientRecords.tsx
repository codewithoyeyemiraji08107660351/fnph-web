import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { patientRecordsApi, type PatientRecord } from '@/lib/api/endpoints/records'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, formatPhone, humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/Field'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

function FinanceReport({ patientId }: { patientId: string }) {
  const report = useQuery({ queryKey: ['patient-finance', patientId], queryFn: () => patientRecordsApi.financeReport(patientId) })
  if (report.isLoading) return <Spinner />
  if (report.isError) return <p className="text-sm text-alarm">{toApiError(report.error).message}</p>
  const rows = report.data?.rows ?? []
  if (!rows.length) return <p className="text-sm text-muted">No payments for this patient.</p>
  const cols = Object.keys(rows[0])
  return (
    <div className="overflow-x-auto">
      <table className="table-base min-w-[520px]">
        <thead><tr>{cols.map((c) => <th key={c}>{humanise(c.replace(/([a-z])([A-Z])/g, '$1_$2'))}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className="text-sm">{typeof r[c] === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(r[c] as string) ? formatDateTime(r[c] as string) : String(r[c] ?? '')}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function RecordDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const rec = useQuery({ queryKey: ['patient-record', id], queryFn: () => patientRecordsApi.get(id) })
  const [dialog, setDialog] = useState<'contact' | 'deactivate' | 'verify' | 'drift' | null>(null)
  const [contact, setContact] = useState({ phoneNumber: '', email: '', address: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activation, setActivation] = useState<string | null>(null)
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['patient-record', id] })
    await qc.invalidateQueries({ queryKey: ['patients'] })
  }
  const p = rec.data
  return (
    <Dialog open size="lg" onClose={onClose} title={p ? `${p.firstName} ${p.lastName}` : 'Patient record'} description={p ? `EHR ${p.ehrNumber}` : undefined}>
      {rec.isLoading && <Spinner />}
      {rec.isError && <ErrorState error={rec.error} />}
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {activation && <Alert tone="info" className="mb-4">{activation}</Alert>}
      {p && (
        <div className="space-y-5">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Phone</dt><dd>{p.phoneNumber ? formatPhone(p.phoneNumber) : 'None'}</dd></div>
            <div><dt className="text-xs text-muted">Email</dt><dd>{p.email ?? 'None'}</dd></div>
            <div><dt className="text-xs text-muted">Online account</dt><dd>{p.isActive ? `Active since ${formatDateTime(p.activatedAt)}` : 'Not active'}</dd></div>
            <div><dt className="text-xs text-muted">Eligibility checked</dt><dd>{p.eligibilityVerifiedAt ? `${formatDateTime(p.eligibilityVerifiedAt)}, ${p.eligibilityVerifiedBy}` : 'Not recorded'}</dd></div>
          </dl>
          {p.driftFlagged && <Alert tone="warning" title="The hospital export no longer matches this record">{p.driftDetails}</Alert>}
          <div className="flex flex-wrap gap-2">
            {can('patient.update') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setContact({ phoneNumber: p.phoneNumber ?? '', email: p.email ?? '', address: '' }); setDialog('contact') }}>Update contact details</button>}
            {can('patient.verify') && !p.eligibilityVerifiedAt && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog('verify')}>Record eligibility check</button>}
            {can('patient.activate') && !p.isActive && (
              <button type="button" className="btn btn-primary btn-sm" disabled={busy || !p.eligibilityVerifiedAt} title={p.eligibilityVerifiedAt ? undefined : 'Record the eligibility check first'} onClick={async () => {
                setBusy(true); setError(null)
                try { const r = await patientRecordsApi.activate(p.publicId); setActivation(`Account ${r.username} created. ${r.note}`); await refresh() } catch (err) { setError(toApiError(err).message) } finally { setBusy(false) }
              }}>Create online account</button>
            )}
            {can('patient.flag_drift') && p.driftFlagged && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog('drift')}>Clear the mismatch</button>}
            {can('patient.update') && p.isActive && <button type="button" className="btn btn-quiet btn-sm text-alarm" onClick={() => setDialog('deactivate')}>Deactivate</button>}
          </div>
          {can('finance_report.read') && (
            <section>
              <h3 className="mb-2 font-display font-extrabold">Payments</h3>
              <FinanceReport patientId={p.publicId} />
            </section>
          )}
        </div>
      )}
      {dialog === 'contact' && p && (
        <Dialog open onClose={() => setDialog(null)} busy={busy} title="Update contact details" description="Only what you change is sent."
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
              setBusy(true); setError(null)
              const changed = {
                phoneNumber: contact.phoneNumber !== (p.phoneNumber ?? '') ? contact.phoneNumber : undefined,
                email: contact.email !== (p.email ?? '') ? contact.email : undefined,
                address: contact.address || undefined,
              }
              try { await patientRecordsApi.update(p.publicId, changed); toast('Contact details updated.'); setDialog(null); await refresh() } catch (err) { setError(toApiError(err).message) } finally { setBusy(false) }
            }}>Save</button></>}>
          <div className="space-y-4">
            <TextField label="Phone" type="tel" value={contact.phoneNumber} onChange={(e) => setContact({ ...contact, phoneNumber: e.target.value })} />
            <TextField label="Email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
            <TextField label="Address (leave blank to keep)" value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} />
          </div>
        </Dialog>
      )}
      {dialog === 'verify' && p && (
        <ReasonDialog title="Record the eligibility check" label="Who assessed the patient, where and when" min={10} confirmLabel="Record"
          description="Remote consultations are only for patients already assessed in person at FNPH."
          placeholder="Seen by Dr Bello at the outpatient clinic on 3 June 2026."
          onClose={() => setDialog(null)}
          onConfirm={async (detail) => { await patientRecordsApi.verify(p.publicId, detail); toast('Eligibility recorded.'); setDialog(null); await refresh() }} />
      )}
      {dialog === 'drift' && p && (
        <ReasonDialog title="Clear the mismatch" label="What was checked" min={5} confirmLabel="Clear"
          onClose={() => setDialog(null)}
          onConfirm={async (notes) => { await patientRecordsApi.clearDrift(p.publicId, notes); toast('Mismatch cleared.'); setDialog(null); await refresh() }} />
      )}
      {dialog === 'deactivate' && p && (
        <ReasonDialog title={`Deactivate ${p.firstName} ${p.lastName}?`} danger label="Why" confirmLabel="Deactivate"
          description="The patient can no longer sign in or book. Their history stays."
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => { await patientRecordsApi.deactivate(p.publicId, reason); toast('Patient deactivated.'); setDialog(null); await refresh() }} />
      )}
    </Dialog>
  )
}

export function PatientRecords() {
  const [term, setTerm] = useState('')
  const [applied, setApplied] = useState('')
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const list = useQuery({ queryKey: ['patients', applied, page], queryFn: () => patientRecordsApi.search(applied, page) })
  return (
    <>
      <PageHeader kicker="Hospital records" title="Patients" description="FNPH patients with an online record. Search by name, hospital number or phone." />
      <Panel bodyClassName="">
        <form className="flex gap-2 border-b border-line p-4" onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied(term.trim()) }}>
          <input className="input" aria-label="Search patients" placeholder="Name, EHR number or phone" value={term} onChange={(e) => setTerm(e.target.value)} />
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {list.data?.length === 0 && <EmptyState icon="bi-person" title="No patients match" />}
        <ul className="divide-y divide-line">
          {list.data?.map((p: PatientRecord) => (
            <li key={p.publicId}>
              <button type="button" onClick={() => setOpenId(p.publicId)} className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left hover:bg-soft/60">
                <span><span className="block font-bold">{p.firstName} {p.lastName}</span><span className="block text-xs text-muted">EHR {p.ehrNumber}{p.phoneNumber ? `. ${formatPhone(p.phoneNumber)}` : ''}</span></span>
                <span className="flex gap-1">
                  {p.driftFlagged && <Badge tone="gold">Mismatch</Badge>}
                  {p.isActive ? <Badge tone="green">Online</Badge> : <Badge>Not active</Badge>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-line px-5 py-3">
          <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={(list.data?.length ?? 0) < 50} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </Panel>
      {openId && <RecordDialog id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
