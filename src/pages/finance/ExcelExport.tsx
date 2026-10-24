import { useState } from 'react'
import { financeApi } from '@/lib/api/endpoints/finance'
import { toApiError } from '@/lib/api/http'
import { useNow } from '@/lib/hooks/useNow'
import { Panel } from '@/components/ui/Page'
import { TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { exportPresets, formatDay, MAX_EXPORT_DAYS, rangeProblem, watDay } from '@/features/finance/exportRange'

const SHEETS = ['Summary', 'Payments', 'Daily totals', 'Failed and reversed', 'Exceptions', 'Centre wallets', 'Wallet ledger']

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
 * Downloads the Finance workbook for a chosen period.
 *
 * Dates are hospital days. The server owns the figures and the limits; the
 * checks here only save a round trip for a range it would refuse anyway.
 */
export function ExcelExport() {
  const today = watDay(useNow(60_000))
  const presets = exportPresets(today)
  const [from, setFrom] = useState(presets[0].from)
  const [to, setTo] = useState(presets[0].to)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const problem = rangeProblem(from, to, today)
  const activePreset = presets.find((p) => p.from === from && p.to === to)?.key

  const pick = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom)
    setTo(nextTo)
    setError(null)
    setDone(null)
  }

  const download = async () => {
    if (problem) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const { blob, filename } = await financeApi.exportXlsx(from, to)
      saveBlob(blob, filename)
      setDone(filename)
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      title="Excel report"
      action={<span className="text-xs text-muted">WAT days, both dates included</span>}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick periods">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={activePreset === p.key}
            className={`btn btn-sm ${activePreset === p.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => pick(p.from, p.to)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <TextField label="From" type="date" value={from} max={today} onChange={(e) => pick(e.target.value, to)} />
        <TextField label="To" type="date" value={to} min={from || undefined} onChange={(e) => pick(from, e.target.value)} />
        <button type="button" className="btn btn-primary" disabled={busy || Boolean(problem)} onClick={() => void download()}>
          {busy ? <Spinner label="Preparing workbook" inverted /> : <><i className="bi bi-file-earmark-spreadsheet" aria-hidden="true" /> Download Excel</>}
        </button>
      </div>

      <p className="mt-3 text-sm text-muted">
        {problem
          ? problem
          : `${formatDay(from)} to ${formatDay(to > today ? today : to)}. Sheets: ${SHEETS.join(', ')}.`}
      </p>
      <p className="mt-1 text-xs text-muted">
        Up to {MAX_EXPORT_DAYS} days per file. Patients appear by EHR number only. Every download is recorded in the audit trail.
      </p>

      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      {done && <Alert tone="success" className="mt-4">Downloaded {done}.</Alert>}
    </Panel>
  )
}
