import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ictApi, type EhrImport } from '@/lib/api/endpoints/operations'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { DISPLAY_TIME_ZONE, formatCalendarDate, formatDateTime, humanise } from '@/lib/format'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE }).format(new Date())

export function EhrImports() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const active = useQuery({ queryKey: ['ehr-active'], queryFn: ictApi.active, retry: false })
  const imports = useQuery({ queryKey: ['ehr-imports'], queryFn: ictApi.imports })
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [asAt, setAsAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activating, setActivating] = useState<EhrImport | null>(null)
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['ehr-imports'] })
    void qc.invalidateQueries({ queryKey: ['ehr-active'] })
  }
  const upload = async () => {
    if (!file || !asAt) return setError('Choose the export file and the date it was taken.')
    setBusy(true)
    setError(null)
    try {
      const r = await ictApi.upload(file, asAt)
      toast(`Checked: ${r.validRowCount} of ${r.rowCount} rows valid. It is not in use until activated.`, r.rejectedRowCount ? 'info' : 'success')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      refresh()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeader kicker="Hospital records" title="EHR exports" description="The active export decides who can enrol online. Uploading only checks a file; activating it is a separate decision, made by someone else." />
      {active.isLoading ? <Spinner /> : active.data ? (
        <Alert tone="info" className="mb-5" title="In use">
          The active export was taken on <strong>{formatCalendarDate(active.data.sourceAsAt)}</strong> ({active.data.ageInDays} days ago) and holds {active.data.validRowCount} patients. Patients see this date when they enrol.
        </Alert>
      ) : (
        <Alert tone="danger" className="mb-5" title="No export is active">Nobody can enrol online until one is. Every attempt goes to the manual verification queue.</Alert>
      )}
      {can('ehr_import.upload') && (
        <Panel title="Check a new export">
          {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="field-label">Export file (CSV)</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="input py-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <TextField label="Date the export was taken" type="date" max={today()} value={asAt} onChange={(e) => setAsAt(e.target.value)} />
            <button type="button" className="btn btn-primary" disabled={busy} onClick={upload}>{busy ? <Spinner label="Checking" inverted /> : 'Check file'}</button>
          </div>
          <p className="mt-2 text-xs text-muted">Enter the date the export was actually taken from the hospital system, not today’s date. Patients are told their record is current as of this date, and it explains to them why a code went to an old number.</p>
        </Panel>
      )}
      <Panel title="Recent exports" className="mt-5" bodyClassName="">
        {imports.isLoading && <div className="p-5"><Spinner /></div>}
        {imports.isError && <ErrorState error={imports.error} />}
        <ul className="divide-y divide-line">
          {imports.data?.map((i) => (
            <li key={i.publicId} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="block font-bold">{i.fileName}</span>
                  <span className="block text-xs text-muted">Taken {formatCalendarDate(i.sourceAsAt)}. Uploaded {formatDateTime(i.uploadedAt)} by {i.uploadedBy}. {i.validRowCount} valid, {i.rejectedRowCount} rejected{i.driftDetectedCount ? `, ${i.driftDetectedCount} changed since the last export` : ''}.</span>
                  {i.activatedAt && <span className="block text-xs text-muted">Activated {formatDateTime(i.activatedAt)} by {i.activatedBy}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={i.status === 'ACTIVE' ? 'green' : i.status === 'REJECTED' ? 'red' : i.status === 'VALIDATED' ? 'navy' : 'grey'}>{humanise(i.status)}</Badge>
                  {can('ehr_import.activate') && i.status === 'VALIDATED' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setActivating(i)}>Make this the active export</button>}
                </span>
              </div>
              {i.validationReport && <details className="mt-1 text-xs"><summary className="cursor-pointer text-muted">Validation report</summary><pre className="mt-1 max-h-48 overflow-auto rounded-[10px] bg-canvas p-2 whitespace-pre-wrap">{i.validationReport}</pre></details>}
            </li>
          ))}
        </ul>
      </Panel>
      {activating && (
        <ReasonDialog title="Make this the active export?"
          description={`From now on, patients enrol against the export taken on ${formatCalendarDate(activating.sourceAsAt)}, and see that date. The previous export stops being used.`}
          confirmLabel="Activate" onClose={() => setActivating(null)}
          onConfirm={async (reason) => { await ictApi.activate(activating.publicId, reason); toast('Export activated.'); setActivating(null); refresh() }} />
      )}
    </>
  )
}
