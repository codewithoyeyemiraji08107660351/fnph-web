import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { financeApi, type PaymentException } from '@/lib/api/endpoints/finance'
import { toApiError } from '@/lib/api/http'
import { formatDateTime, formatNaira, humanise, watInputToServer } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

export function Reconciliation() {
  const qc = useQueryClient()
  const toast = useToast()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState<{ checked: number; matched: number; exceptions: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState<PaymentException | null>(null)
  const exceptions = useQuery({ queryKey: ['payment-exceptions'], queryFn: () => financeApi.exceptions() })
  return (
    <>
      <PageHeader kicker="Finance" title="Reconciliation" description="Check local payments against what Remita reports. Anything that does not match becomes an exception to work through." />
      <Panel title="Run a check">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <TextField label="From (WAT, optional)" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="To (WAT, optional)" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" className="btn btn-primary" disabled={running} onClick={async () => {
            setRunning(true); setError(null)
            try { setRun(await financeApi.reconcile(watInputToServer(from), watInputToServer(to))); await qc.invalidateQueries({ queryKey: ['payment-exceptions'] }) }
            catch (err) { setError(toApiError(err).message) } finally { setRunning(false) }
          }}>{running ? <Spinner label="Checking" inverted /> : 'Run now'}</button>
        </div>
        <p className="mt-2 text-xs text-muted">Leave the dates blank to check the last seven days.</p>
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
        {run && <Alert tone={run.exceptions ? 'warning' : 'success'} className="mt-4">Checked {run.checked}, matched {run.matched}, {run.exceptions} exception{run.exceptions === 1 ? '' : 's'} raised.</Alert>}
      </Panel>
      <Panel title="Open exceptions" className="mt-5" bodyClassName="">
        {exceptions.isLoading && <div className="p-5"><Spinner /></div>}
        {exceptions.isError && <ErrorState error={exceptions.error} />}
        {exceptions.data?.length === 0 && <EmptyState icon="bi-check2-circle" title="Nothing unresolved" />}
        <ul className="divide-y divide-line">
          {exceptions.data?.map((e) => (
            <li key={e.publicId} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
              <span className="text-sm">
                <strong>{humanise(e.type)}</strong> <span className="text-muted">raised {formatDateTime(e.raisedAt)}</span>
                {(e.expected || e.reported) && <span className="block text-xs text-muted">Expected {formatNaira(e.expected)}, Remita reported {formatNaira(e.reported)}</span>}
                {e.details && <span className="block text-xs">{e.details}</span>}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setResolving(e)}>Resolve</button>
            </li>
          ))}
        </ul>
      </Panel>
      {resolving && (
        <ReasonDialog title={`Resolve ${humanise(resolving.type).toLowerCase()}`} label="What was found and done" confirmLabel="Resolve"
          description="Notes are required. They are what an auditor reads."
          onClose={() => setResolving(null)}
          onConfirm={async (notes) => { await financeApi.resolveException(resolving.publicId, notes); toast('Exception resolved.'); setResolving(null); await qc.invalidateQueries({ queryKey: ['payment-exceptions'] }) }} />
      )}
    </>
  )
}
