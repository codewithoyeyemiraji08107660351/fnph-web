import { useState } from 'react'
import { financeApi, type FinanceReport, type ReportKind } from '@/lib/api/endpoints/finance'
import { toApiError } from '@/lib/api/http'
import { formatDateTime, humanise, watInputToServer } from '@/lib/format'
import { PageHeader, Panel } from '@/components/ui/Page'
import { SelectField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

const KINDS: Array<{ value: ReportKind; label: string; dates: 'range' | 'year' | 'none' }> = [
  { value: 'daily', label: 'Daily collections', dates: 'range' },
  { value: 'monthly', label: 'Monthly totals', dates: 'year' },
  { value: 'reconciliation', label: 'Reconciliation runs', dates: 'none' },
  { value: 'exceptions', label: 'Exceptions', dates: 'none' },
  { value: 'failures', label: 'Failed payments', dates: 'range' },
  { value: 'reversals', label: 'Reversals', dates: 'range' },
]

const cell = (v: unknown) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDateTime(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** The six reports share one generic shape, so one table renders them all. */
export function Reports() {
  const [kind, setKind] = useState<ReportKind>('daily')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [report, setReport] = useState<FinanceReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const meta = KINDS.find((k) => k.value === kind)!
  const columns = report?.rows.length ? Object.keys(report.rows[0]) : []
  return (
    <>
      <PageHeader kicker="Finance" title="Reports" />
      <Panel>
        <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <SelectField label="Report" value={kind} onChange={(e) => { setKind(e.target.value as ReportKind); setReport(null) }}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </SelectField>
          {meta.dates === 'range' && (
            <>
              <TextField label="From (WAT)" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
              <TextField label="To (WAT)" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
          {meta.dates === 'year' && <TextField label="Year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
            setBusy(true); setError(null)
            try { setReport(await financeApi.report(kind, { from: watInputToServer(from), to: watInputToServer(to), year: Number(year) })) }
            catch (err) { setError(toApiError(err).message) } finally { setBusy(false) }
          }}>{busy ? <Spinner label="Running" inverted /> : 'Run report'}</button>
        </div>
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      </Panel>
      {report && (
        <Panel title={humanise(report.name)} className="mt-5" action={<span className="text-xs text-muted">{report.rowCount} rows. Generated {formatDateTime(report.generatedAt)}</span>} bodyClassName="">
          {report.rows.length === 0 ? <p className="px-5 py-4 text-sm text-muted">No rows for this period.</p> : (
            <div className="overflow-x-auto">
              <table className="table-base min-w-[600px]">
                <thead><tr>{columns.map((c) => <th key={c}>{humanise(c.replace(/([a-z])([A-Z])/g, '$1_$2'))}</th>)}</tr></thead>
                <tbody>{report.rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c} className="text-sm">{cell(r[c])}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </>
  )
}
