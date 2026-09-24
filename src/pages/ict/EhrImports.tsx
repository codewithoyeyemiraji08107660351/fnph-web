import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ictApi, type ManualEhrRecord, type ManualEhrRecordInput } from '@/lib/api/endpoints/operations'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { DISPLAY_TIME_ZONE, formatCalendarDate, formatDateTime, humanise } from '@/lib/format'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { ReasonField, SelectField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Dialog } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE }).format(new Date())
const emptyManual = (): ManualEhrRecordInput => ({ ehrNumber: '', fullName: '', dateOfBirth: '', phoneNumber: '', email: '', clinic: '', patientStatus: 'ACTIVE', active: true, reason: '' })

function ManualRecordDialog({ record, onClose, onSaved }: { record?: ManualEhrRecord; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState<ManualEhrRecordInput>(() => record ? {
    ehrNumber: record.ehrNumber, fullName: record.fullName, dateOfBirth: record.dateOfBirth,
    phoneNumber: record.phoneNumber ?? '', email: record.email ?? '', clinic: record.clinic ?? '',
    patientStatus: record.patientStatus ?? '', active: record.active, reason: '', version: record.version,
  } : emptyManual())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof ManualEhrRecordInput>(key: K, value: ManualEhrRecordInput[K]) => setForm((old) => ({ ...old, [key]: value }))
  const save = async () => {
    setBusy(true); setError(null)
    try {
      if (record) await ictApi.updateManualRecord(record.publicId, form)
      else await ictApi.createManualRecord(form)
      toast(record ? 'Manual EHR record updated.' : 'Manual EHR record added.', 'success')
      onSaved()
    } catch (err) { setError(toApiError(err).message) } finally { setBusy(false) }
  }
  const valid = form.ehrNumber.trim() && form.fullName.trim() && form.dateOfBirth && form.reason.trim().length >= 5
  return <Dialog open onClose={onClose} busy={busy} title={record ? `Edit ${record.ehrNumber}` : 'Add EHR details manually'}
    description="This governed record becomes available to patient enrolment and is compared with every active import."
    footer={<><button className="btn btn-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary" type="button" onClick={save} disabled={busy || !valid}>{busy ? <Spinner label="Saving" inverted /> : 'Save record'}</button></>}>
    {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="EHR number" required maxLength={50} value={form.ehrNumber} onChange={(e) => set('ehrNumber', e.target.value)} />
      <TextField label="Full name" required maxLength={150} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
      <TextField label="Date of birth" type="date" required max={today()} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
      <TextField label="Phone number" type="tel" value={form.phoneNumber} onChange={(e) => set('phoneNumber', e.target.value)} />
      <TextField label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
      <TextField label="Clinic" value={form.clinic} onChange={(e) => set('clinic', e.target.value)} />
      <TextField label="Patient status" value={form.patientStatus} onChange={(e) => set('patientStatus', e.target.value)} />
      <SelectField label="Record availability" value={form.active ? 'true' : 'false'} onChange={(e) => set('active', e.target.value === 'true')}><option value="true">Active for enrolment</option><option value="false">Inactive</option></SelectField>
      <div className="sm:col-span-2"><ReasonField value={form.reason} onChange={(v) => set('reason', v)} min={5} label="Reason for adding or changing this record" /></div>
    </div>
  </Dialog>
}

function SyncDialog({ record, onClose, onSaved }: { record: ManualEhrRecord; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [direction, setDirection] = useState<'FROM_IMPORT' | 'TO_IMPORT'>(record.syncStatus === 'MANUAL_ONLY' ? 'TO_IMPORT' : 'FROM_IMPORT')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async () => {
    setBusy(true); setError(null)
    try { await ictApi.syncManualRecord(record.publicId, direction, reason); toast('Manual and imported EHR details synchronized.', 'success'); onSaved() }
    catch (err) { setError(toApiError(err).message) } finally { setBusy(false) }
  }
  return <Dialog open onClose={onClose} busy={busy} title={`Synchronize ${record.ehrNumber}`}
    description="Choose which copy is authoritative. The action and reason are written to the audit trail."
    footer={<><button className="btn btn-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary" type="button" onClick={run} disabled={busy || reason.trim().length < 5}>{busy ? <Spinner label="Syncing" inverted /> : 'Synchronize'}</button></>}>
    {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
    <div className="space-y-4">
      <SelectField label="Synchronization direction" value={direction} onChange={(e) => setDirection(e.target.value as 'FROM_IMPORT' | 'TO_IMPORT')}>
        {record.syncStatus !== 'MANUAL_ONLY' && <option value="FROM_IMPORT">Replace manual details with active import</option>}
        <option value="TO_IMPORT">Write manual details to active import</option>
      </SelectField>
      <Alert tone="info">{direction === 'FROM_IMPORT' ? 'The current manual details will be replaced.' : 'The active imported row will be created or replaced. An enrolled patient account is flagged for HIM review instead of being changed.'}</Alert>
      <ReasonField value={reason} onChange={setReason} min={5} label="Reason for synchronization" />
    </div>
  </Dialog>
}

export function EhrImports() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const active = useQuery({ queryKey: ['ehr-active'], queryFn: ictApi.active, retry: false })
  const imports = useQuery({ queryKey: ['ehr-imports'], queryFn: ictApi.imports })
  const manual = useQuery({ queryKey: ['ehr-manual-records'], queryFn: ictApi.manualRecords })
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [asAt, setAsAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ManualEhrRecord | 'new' | null>(null)
  const [syncing, setSyncing] = useState<ManualEhrRecord | null>(null)
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['ehr-imports'] }); void qc.invalidateQueries({ queryKey: ['ehr-active'] }); void qc.invalidateQueries({ queryKey: ['ehr-manual-records'] }) }
  const refreshManual = () => { refresh(); setEditing(null); setSyncing(null) }
  const upload = async () => {
    if (!file || !asAt) return setError('Choose the export file and the date it was taken.')
    setBusy(true); setError(null)
    try {
      const r = await ictApi.upload(file, asAt)
      if (r.status === 'REJECTED') toast('Not loaded: the file has no usable rows. Open its report in the list below to see why.', 'error')
      else toast(r.rejectedRowCount ? `Export is now active. Loaded ${r.validRowCount} of ${r.rowCount} rows; ${r.rejectedRowCount} skipped (see its report).` : `Export is now active. Loaded all ${r.validRowCount} rows.`, r.rejectedRowCount ? 'info' : 'success')
      setFile(null); if (fileRef.current) fileRef.current.value = ''; refresh()
    } catch (err) { setError(toApiError(err).message) } finally { setBusy(false) }
  }
  return <>
    <PageHeader kicker="Hospital records" title="EHR exports" description="The active export and governed manual records decide who can enrol online. Successful uploads automatically replace the previous active export." />
    {active.isLoading ? <Spinner /> : active.data ? <Alert tone="info" className="mb-5" title="In use">The active export was taken on <strong>{formatCalendarDate(active.data.sourceAsAt)}</strong> ({active.data.ageInDays} days ago) and holds {active.data.validRowCount} patients. Patients see this date when they enrol.</Alert> : <Alert tone="danger" className="mb-5" title="No export is active">Nobody can enrol online until an export is active. Every attempt goes to the manual verification queue.</Alert>}
    {can('ehr_import.upload') && <Panel title="Upload a new export">
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end"><label className="block"><span className="field-label">Export file (CSV)</span><input ref={fileRef} type="file" accept=".csv,text/csv" className="input py-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label><TextField label="Date the export was taken" type="date" max={today()} value={asAt} onChange={(e) => setAsAt(e.target.value)} /><button type="button" className="btn btn-primary" disabled={busy} onClick={upload}>{busy ? <Spinner label="Uploading" inverted /> : 'Upload and activate'}</button></div>
      <p className="mt-2 text-xs text-muted">Enter the date the export was actually taken from the hospital system. Manual records are re-compared automatically when the new export becomes active.</p>
    </Panel>}

    <Panel title="Manual EHR details" className="mt-5" bodyClassName="">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"><p className="max-w-3xl text-sm text-muted">Add a patient who is missing from the export, or maintain a governed working copy. Each record shows whether it agrees with the active import.</p>{can('ehr_import.upload') && <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><i className="bi bi-plus-lg" aria-hidden /> Add manual record</button>}</div>
      {manual.isLoading && <div className="p-5"><Spinner /></div>}{manual.isError && <ErrorState error={manual.error} />}
      {manual.data?.length === 0 && <p className="p-5 text-sm text-muted">No manual EHR records have been added.</p>}
      {!!manual.data?.length && <div className="overflow-x-auto"><table className="table-base min-w-[900px]"><thead><tr><th>EHR / patient</th><th>Contact</th><th>Clinic</th><th>Import comparison</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{manual.data.map((r) => <tr key={r.publicId}>
        <td><span className="block font-bold">{r.ehrNumber}</span><span className="block text-xs text-muted">{r.fullName} · DOB {formatCalendarDate(r.dateOfBirth)}</span>{!r.active && <Badge tone="grey">Inactive</Badge>}</td>
        <td className="text-sm">{r.phoneNumber || r.email || 'No contact'}{r.phoneNumber && r.email && <span className="block text-xs text-muted">{r.email}</span>}</td>
        <td className="text-sm">{r.clinic || '—'}<span className="block text-xs text-muted">{r.patientStatus || 'No status'}</span></td>
        <td><Badge tone={r.syncStatus === 'MATCHED' ? 'green' : r.syncStatus === 'DIFFERENT' ? 'red' : 'navy'}>{humanise(r.syncStatus)}</Badge>{r.lastSyncedAt && <span className="mt-1 block text-xs text-muted">Last synced {formatDateTime(r.lastSyncedAt)}</span>}</td>
        <td className="text-xs text-muted">{r.updatedAt ? formatDateTime(r.updatedAt) : 'Just now'}{r.updatedBy && <span className="block">by {r.updatedBy}</span>}</td>
        <td><span className="flex justify-end gap-2">{can('ehr_import.upload') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(r)}>Edit</button>}{can('ehr_import.activate') && !['MATCHED', 'NO_ACTIVE_IMPORT'].includes(r.syncStatus) && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSyncing(r)}>Sync</button>}</span></td>
      </tr>)}</tbody></table></div>}
    </Panel>

    <Panel title="Recent exports" className="mt-5" bodyClassName="">{imports.isLoading && <div className="p-5"><Spinner /></div>}{imports.isError && <ErrorState error={imports.error} />}<ul className="divide-y divide-line">{imports.data?.map((i) => <li key={i.publicId} className="px-5 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><span><span className="block font-bold">{i.fileName}</span><span className="block text-xs text-muted">Taken {formatCalendarDate(i.sourceAsAt)}. Uploaded {formatDateTime(i.uploadedAt)} by {i.uploadedBy}. {i.validRowCount} valid, {i.rejectedRowCount} rejected{i.driftDetectedCount ? `, ${i.driftDetectedCount} changed since the last export` : ''}.</span>{i.activatedAt && <span className="block text-xs text-muted">Activated {formatDateTime(i.activatedAt)} by {i.activatedBy}</span>}</span><Badge tone={i.status === 'ACTIVE' ? 'green' : i.status === 'REJECTED' ? 'red' : i.status === 'VALIDATED' ? 'navy' : 'grey'}>{humanise(i.status)}</Badge></div>{i.validationReport && <details className="mt-1 text-xs"><summary className="cursor-pointer text-muted">Validation report</summary><pre className="mt-1 max-h-48 overflow-auto rounded-[10px] bg-canvas p-2 whitespace-pre-wrap">{i.validationReport}</pre></details>}</li>)}</ul></Panel>
    {editing && <ManualRecordDialog record={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={refreshManual} />}
    {syncing && <SyncDialog record={syncing} onClose={() => setSyncing(null)} onSaved={refreshManual} />}
  </>
}