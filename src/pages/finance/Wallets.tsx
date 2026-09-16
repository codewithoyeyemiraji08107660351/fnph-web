import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { financeApi, type WalletRow } from '@/lib/api/endpoints/finance'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, formatNaira, humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

function CreditDialog({ wallet, onClose, onDone }: { wallet: WalletRow; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ amount: '', reference: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(f.amount)
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter a positive amount.')
    if (!f.reference.trim()) return setError('The funding reference is required.')
    setBusy(true)
    setError(null)
    try {
      const r = await financeApi.credit(wallet.centrePublicId, { amount: f.amount.trim(), reference: f.reference.trim(), description: f.description.trim() || undefined })
      toast(r.replayed ? `That reference was already posted. Nothing was added; the balance is ${formatNaira(r.balance)}.` : `${formatNaira(r.amount)} credited. Balance ${formatNaira(r.balance)}.`, r.replayed ? 'info' : 'success')
      onDone()
    } catch (err) {
      setError(toApiError(err).message)
      setBusy(false)
    }
  }
  return (
    <Dialog open onClose={onClose} busy={busy} title={`Credit ${wallet.centre}`} description={`Current balance ${formatNaira(wallet.balance)}. The centre never sees amounts.`}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" form="credit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Posting" inverted /> : 'Post credit'}</button></>}>
      <form id="credit" onSubmit={submit} noValidate className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <TextField label="Amount (NGN)" type="number" min="1" step="0.01" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <TextField
          label="Funding instrument reference"
          value={f.reference}
          onChange={(e) => setF({ ...f, reference: e.target.value })}
          hint="Required. The transfer or treasury reference for this money. Posting the same reference again adds nothing, which is what stops a double submission crediting twice."
        />
        <TextField label="Description (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </form>
    </Dialog>
  )
}

function LedgerDialog({ wallet, onClose }: { wallet: WalletRow; onClose: () => void }) {
  const ledger = useQuery({ queryKey: ['ledger', wallet.centrePublicId], queryFn: () => financeApi.ledger(wallet.centrePublicId) })
  return (
    <Dialog open size="lg" onClose={onClose} title={`${wallet.centre} ledger`} description="Latest 50 entries.">
      {ledger.isLoading && <Spinner />}
      {ledger.isError && <ErrorState error={ledger.error} />}
      {ledger.data?.length === 0 && <p className="text-sm text-muted">No entries.</p>}
      <div className="overflow-x-auto">
        <table className="table-base min-w-[560px]">
          <thead><tr><th>When</th><th>Entry</th><th className="text-right">Amount</th><th className="text-right">Balance</th></tr></thead>
          <tbody>
            {ledger.data?.map((l, i) => (
              <tr key={i}>
                <td className="text-xs whitespace-nowrap">{formatDateTime(l.at)}</td>
                <td className="text-sm">{humanise(l.direction)} <span className="text-muted">{l.reference}</span>{l.description && <span className="block text-xs text-muted">{l.description}</span>}</td>
                <td className={`text-right ${l.direction === 'DEBIT' ? 'text-alarm' : 'text-forest'}`}>{l.direction === 'DEBIT' ? '-' : '+'}{formatNaira(l.amount)}</td>
                <td className="text-right">{formatNaira(l.balanceAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}

export function Wallets() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const wallets = useQuery({ queryKey: ['wallets'], queryFn: financeApi.wallets })
  const [crediting, setCrediting] = useState<WalletRow | null>(null)
  const [viewing, setViewing] = useState<WalletRow | null>(null)
  return (
    <>
      <PageHeader kicker="Finance" title="Centre wallets" description="Each centre’s prepaid balance. A booking is charged when the Hub Coordinator approves it, so a centre that cannot cover the next booking cannot be approved." />
      <Panel bodyClassName="">
        {wallets.isLoading && <div className="p-5"><Spinner /></div>}
        {wallets.isError && <ErrorState error={wallets.error} onRetry={() => wallets.refetch()} />}
        {wallets.data?.length === 0 && <EmptyState icon="bi-wallet2" title="No centre wallets" />}
        <div className="overflow-x-auto">
          {!!wallets.data?.length && (
            <table className="table-base min-w-[620px]">
              <thead><tr><th>Centre</th><th className="text-right">Balance</th><th>Next booking</th><th /></tr></thead>
              <tbody>
                {wallets.data.map((w) => (
                  <tr key={w.centrePublicId}>
                    <td className="font-bold">{w.centre}</td>
                    <td className="text-right font-display font-extrabold">{formatNaira(w.balance)}</td>
                    <td>{w.canCoverNextBooking ? <Badge tone="green">Covered</Badge> : <Badge tone="red">Cannot cover</Badge>}</td>
                    <td className="text-right whitespace-nowrap">
                      {can('wallet.read_ledger') && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setViewing(w)}>Ledger</button>}
                      {can('wallet.credit') && <button type="button" className="btn btn-primary btn-sm" onClick={() => setCrediting(w)}>Credit</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
      {crediting && <CreditDialog wallet={crediting} onClose={() => setCrediting(null)} onDone={() => { setCrediting(null); void qc.invalidateQueries({ queryKey: ['wallets'] }); void qc.invalidateQueries({ queryKey: ['finance-alerts'] }) }} />}
      {viewing && <LedgerDialog wallet={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
