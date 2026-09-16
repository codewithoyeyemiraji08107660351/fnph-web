import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { financeApi } from '@/lib/api/endpoints/finance'
import { formatDateTime, formatLongDate, formatNaira } from '@/lib/format'
import { ErrorState, PageHeader, Panel, Stat } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'

export function FinanceOverview() {
  const summary = useQuery({ queryKey: ['finance-summary'], queryFn: () => financeApi.summary() })
  const alerts = useQuery({ queryKey: ['finance-alerts'], queryFn: financeApi.alerts })
  const s = summary.data ?? {}
  return (
    <>
      <PageHeader kicker={formatLongDate()} title="Finance" description="The last 30 days: what patients paid through Remita, what credit covered, and what needs attention." />
      {summary.isLoading && <Spinner />}
      {summary.isError && <ErrorState error={summary.error} onRetry={() => summary.refetch()} />}
      {summary.data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Collected through Remita" value={formatNaira(s.collectedFromProvider)} />
          <Stat label="Covered by patient credit" value={formatNaira(s.settledFromPatientCredit)} />
          <Stat label="Payments pending" value={String(s.paymentsPending ?? 0)} tone={Number(s.paymentsPending) ? 'warn' : 'default'} />
          <Stat label="Unresolved exceptions" value={String(s.unresolvedExceptions ?? 0)} tone={Number(s.unresolvedExceptions) ? 'alarm' : 'default'} note={<Link to="/finance/reconciliation">Work through them</Link>} />
          <Stat label="Failed payments" value={String(s.paymentsFailed ?? 0)} />
          <Stat label="Amount mismatches" value={String(s.amountMismatches ?? 0)} note="Patient is owed credit" />
          <Stat label="Centre wallets, total" value={formatNaira(s.centreWalletBalanceTotal)} note={<Link to="/finance/wallets">By centre</Link>} />
        </div>
      )}
      <Panel title="Low-balance alerts" className="mt-6" bodyClassName="">
        {alerts.isLoading && <div className="p-5"><Spinner /></div>}
        {alerts.data?.length === 0 && <p className="px-5 py-4 text-sm text-muted">No centre is running low.</p>}
        <ul className="divide-y divide-line">
          {alerts.data?.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <span><strong>{a.centre}</strong> <span className="text-muted">at {formatNaira(a.balance)}, threshold {formatNaira(a.threshold)}. Raised {formatDateTime(a.raisedAt)}.</span></span>
              <span className="flex items-center gap-2"><Badge tone={String(a.level).includes('CRIT') ? 'red' : 'gold'}>{String(a.level)}</Badge><Link to="/finance/wallets" className="btn btn-secondary btn-sm no-underline">Top up</Link></span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
