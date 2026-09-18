import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ictApi } from '@/lib/api/endpoints/operations'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { DISPLAY_TIME_ZONE, formatCalendarDate, formatDateTime, humanise } from '@/lib/format'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
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
      if (r.status === 'REJECTED') {
        toast('Not loaded: the file has no usable rows. Open its report in the list below to see why.', 'error')
      } else {
        toast(
          r.rejectedRowCount
            ? `Export is now active. Loaded ${r.validRowCount} of ${r.rowCount} rows; ${r.rejectedRowCount} skipped (see its report).`
            : `Export is now active. Loaded all ${r.validRowCount} rows.`,
          r.rejectedRowCount ? 'info' : 'success',
        )
      }
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
      <PageHeader kicker="Hospital records" title="EHR exports" description="The active export decides who can enrol online. A successful upload automatically becomes the active export and replaces the previous one." />
      {active.isLoading ? <Spinner /> : active.data ? (
        <Alert tone="info" className="mb-5" title="In use">
          The active export was taken on <strong>{formatCalendarDate(active.data.sourceAsAt)}</strong> ({active.data.ageInDays} days ago) and holds {active.data.validRowCount} patients. Patients see this date when they enrol.
        </Alert>
      ) : (
        <Alert tone="danger" className="mb-5" title="No export is active">Nobody can enrol online until one is. Every attempt goes to the manual verification queue.</Alert>
      )}
      {can('ehr_import.upload') && (
        <Panel title="Upload a new export">
          {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="field-label">Export file (CSV)</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="input py-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <TextField label="Date the export was taken" type="date" max={today()} value={asAt} onChange={(e) => setAsAt(e.target.value)} />
            <button type="button" className="btn btn-primary" disabled={busy} onClick={upload}>{busy ? <Spinner label="Uploading" inverted /> : 'Upload and activate'}</button>
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
                </span>
              </div>
              {i.validationReport && <details className="mt-1 text-xs"><summary className="cursor-pointer text-muted">Validation report</summary><pre className="mt-1 max-h-48 overflow-auto rounded-[10px] bg-canvas p-2 whitespace-pre-wrap">{i.validationReport}</pre></details>}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
