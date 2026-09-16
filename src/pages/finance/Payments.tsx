import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { financeApi, type FinancePayment } from '@/lib/api/endpoints/finance'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, formatNaira, humanise, watInputToServer } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const STATUSES = ['', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'REFUNDED', 'UNMATCHED']

/**
  The wording is the point. This endpoint records a refund somebody made
  outside the system. Nothing here pays the patient.
*/
function RefundDialog({ payment, onClose }: { payment: FinancePayment; onClose: () => void }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [external, setExternal] = useState('')
  const [paid, setPaid] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog open onClose={onClose} busy={busy} title="Record a refund made elsewhere"
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={busy || !paid || reason.trim().length < 10} onClick={async () => {
          setBusy(true); setError(null)
          try { await financeApi.recordRefund(payment.reference, reason.trim(), external.trim() || undefined); toast('Refund recorded.'); onClose() }
          catch (err) { setError(toApiError(err).message); setBusy(false) }
        }}>{busy ? <Spinner label="Recording" inverted /> : 'Record the refund'}</button></>}>
      <Alert tone="warning" title="This does not send money">
        Consultation fees are non-refundable by FNPH policy. This only records, for the books, a refund that was already paid to the patient by another route. If the patient has not been paid yet, arrange that first and come back.
      </Alert>
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      <p className="mt-4 text-sm">Payment <strong>{payment.reference}</strong>, {formatNaira(payment.amount)}.</p>
      <TextAreaField wrapperClassName="mt-4" label="Why was it refunded, and how?" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} hint={reason.trim().length < 10 ? `At least ${10 - reason.trim().length} more characters.` : undefined} />
      <TextField wrapperClassName="mt-4" label="Reference of the transfer that was made (optional)" value={external} onChange={(e) => setExternal(e.target.value)} />
      <label className="mt-4 flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
        <span>The patient has already received this money.</span>
      </label>
    </Dialog>
  )
}

export function Payments() {
  const { can } = useAuth()
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [refunding, setRefunding] = useState<FinancePayment | null>(null)
  const list = useQuery({
    queryKey: ['finance-payments', status, from, to, page],
    queryFn: () => financeApi.payments({ status: status || undefined, from: watInputToServer(from), to: watInputToServer(to), page }),
  })
  return (
    <>
      <PageHeader kicker="Finance" title="Patient payments" description="Remita payments, newest first. A mismatch means Remita reported a different figure; the difference is held as patient credit." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SelectField label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? humanise(s) : 'Any'}</option>)}
        </SelectField>
        <TextField label="From (WAT, optional)" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField label="To (WAT, optional)" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Panel bodyClassName="">
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {list.data?.length === 0 && <EmptyState icon="bi-receipt" title="No payments match">Without dates, the last 30 days are shown.</EmptyState>}
        <div className="overflow-x-auto">
          {!!list.data?.length && (
            <table className="table-base min-w-[720px]">
              <thead><tr><th>Reference</th><th>Status</th><th className="text-right">Amount</th><th className="text-right">Credit used</th><th>Verified</th><th /></tr></thead>
              <tbody>
                {list.data.map((p) => (
                  <tr key={p.reference}>
                    <td className="text-sm">{p.reference}<span className="block text-xs text-muted">{p.rrr ? `RRR ${p.rrr}` : 'No RRR'}</span></td>
                    <td>
                      <Badge tone={p.status === 'SUCCESS' ? 'green' : p.status === 'PENDING' ? 'gold' : p.status === 'FAILED' ? 'red' : 'grey'}>{humanise(p.status)}</Badge>
                      {p.amountMismatch && <span className="block text-xs text-gold-700">Remita reported {formatNaira(p.reportedAmount)}</span>}
                    </td>
                    <td className="text-right">{formatNaira(p.amount)}</td>
                    <td className="text-right">{formatNaira(p.creditApplied)}</td>
                    <td className="text-xs">{p.verifiedAt ? formatDateTime(p.verifiedAt) : ''}</td>
                    <td className="text-right">{can('payment.refund') && p.status === 'SUCCESS' && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setRefunding(p)}>Record refund</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-between border-t border-line px-5 py-3">
          <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={(list.data?.length ?? 0) < 50} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </Panel>
      {refunding && <RefundDialog payment={refunding} onClose={() => setRefunding(null)} />}
    </>
  )
}
