import { api, seg } from '../http'

export interface WalletRow {
  centre: string
  centrePublicId: string
  balance: number | string
  canCoverNextBooking: boolean
}

export interface LedgerRow {
  reference: string
  direction: 'CREDIT' | 'DEBIT' | string
  amount: number | string
  balanceAfter: number | string
  description?: string
  source?: string
  at: string
}

export interface WalletAlert {
  centre: string
  level: string
  balance: number | string
  threshold: number | string
  raisedAt: string
}

export interface FinancePayment {
  reference: string
  rrr?: string
  status: string
  amount: number | string
  creditApplied: number | string
  amountMismatch: boolean
  reportedAmount?: number | string
  verifiedAt?: string
}

export interface PaymentException {
  publicId: string
  type: string
  expected?: number | string
  reported?: number | string
  details?: string
  raisedAt: string
}

/** FinanceReportService.Report. Rows are generic by design. */
export interface FinanceReport {
  name: string
  periodStart?: string
  periodEnd?: string
  filters?: Record<string, unknown>
  generatedAt: string
  freshness: string
  rowCount: number
  rows: Array<Record<string, unknown>>
}

export type ReportKind = 'daily' | 'monthly' | 'reconciliation' | 'exceptions' | 'failures' | 'reversals'

export const financeApi = {
  summary: (from?: string, to?: string) => api.get<Record<string, number | string>>('/finance/report', { params: { from, to } }),
  wallets: () => api.list<WalletRow>('/finance/wallets'),
  alerts: () => api.list<WalletAlert>('/finance/wallets/alerts'),
  ledger: (centrePublicId: string, page = 0) => api.list<LedgerRow>(`/finance/wallets/${seg(centrePublicId)}/ledger`, { params: { page, size: 50 } }),
  /** The reference is the idempotency key. The same one twice adds nothing. */
  credit: (centrePublicId: string, p: { amount: string; reference: string; description?: string }) =>
    api.post<{ centre: string; amount: number; balance: number; reference: string; replayed?: boolean }>(`/finance/wallets/${seg(centrePublicId)}/credit`, null, { params: p }),
  payments: (p: { from?: string; to?: string; status?: string; page?: number }) =>
    api.list<FinancePayment>('/finance/payments', { params: { ...p, size: 50 } }),
  /** Dates optional: the server covers the last seven days. */
  reconcile: (from?: string, to?: string) =>
    api.post<{ publicId: string; checked: number; matched: number; exceptions: number }>('/finance/reconciliation/run', null, { params: { from, to } }),
  exceptions: (page = 0) => api.list<PaymentException>('/finance/exceptions', { params: { page, size: 50 } }),
  resolveException: (id: string, notes: string) => api.post<void>(`/finance/exceptions/${seg(id)}/resolve`, null, { params: { notes } }),
  /** Records a refund made outside the system. It does not move money. */
  recordRefund: (reference: string, reason: string, externalReference?: string) =>
    api.post<Record<string, unknown>>(`/finance/payments/${seg(reference)}/refund`, null, { params: { reason, externalReference } }),
  report: (kind: ReportKind, p: { from?: string; to?: string; year?: number }) => {
    const params = kind === 'monthly' ? { year: p.year } : kind === 'reconciliation' || kind === 'exceptions' ? {} : { from: p.from, to: p.to }
    return api.get<FinanceReport>(`/finance/reports/${kind}`, { params })
  },
}
