import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CENTRE_QUEUE_SIZE, centreApprovalsApi } from '@/lib/api/endpoints/centre'
import type { CentreApprovalRow } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, formatRelative } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { ReferralDetail } from '@/features/centre/ReferralDetail'
import { ApproveDialog } from './ApproveDialog'

type Tab = 'AWAITING_APPROVAL' | 'APPROVED'

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'AWAITING_APPROVAL', label: 'Awaiting a decision' },
  { value: 'APPROVED', label: 'Confirmed, still to come' },
]

export function CentreApprovals() {
  const { appointmentId } = useParams()
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('AWAITING_APPROVAL')
  const queue = useQuery({
    queryKey: ['centre-approvals', tab],
    queryFn: () => centreApprovalsApi.queue(tab),
    refetchInterval: 60_000,
  })
  const [approving, setApproving] = useState<CentreApprovalRow | null>(null)
  const [returning, setReturning] = useState<CentreApprovalRow | null>(null)
  const [cancelling, setCancelling] = useState<CentreApprovalRow | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['centre-approvals'] })
  const pending = tab === 'AWAITING_APPROVAL'

  return (
    <>
      <PageHeader
        kicker="Hub coordination"
        title="Centre requests"
        description="Consultations requested by Centres of Excellence. Approve with a doctor and a centre consultation room, return the request with what is needed, or cancel a confirmed one before it starts."
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className={`btn btn-sm ${tab === t.value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Panel bodyClassName="">
        {queue.isLoading && <div className="p-5"><Spinner /></div>}
        {queue.isError && <ErrorState error={queue.error} onRetry={() => queue.refetch()} />}
        {queue.data?.length === 0 && (
          <EmptyState icon="bi-buildings" title={pending ? 'No centre requests waiting' : 'No confirmed centre consultations to come'} />
        )}
        <ul className="divide-y divide-line">
          {queue.data?.map((r) => (
            <li key={r.publicId} className={`px-5 py-4 ${r.publicId === appointmentId ? 'bg-accent-soft/60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-extrabold">{formatDateTime(r.appointmentDateTime)} WAT <span className="text-sm font-normal text-muted">({formatRelative(r.appointmentDateTime)})</span></p>
                  <p className="font-bold">{r.patient} <span className="font-normal text-muted">at {r.centre}</span></p>
                  <p className="text-xs text-muted">
                    {r.reference}
                    {!pending && r.doctorName ? `. ${r.doctorName}` : ''}
                    {!pending && r.room ? `, ${r.room}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {pending && can('appointment.reject') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReturning(r)}>Return to centre</button>}
                  {pending && can('appointment.approve') && <button type="button" className="btn btn-primary btn-sm" onClick={() => setApproving(r)}>Approve</button>}
                  {!pending && can('appointment.cancel') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCancelling(r)}>Cancel</button>}
                </div>
              </div>
              {pending && (r.referral || r.referralReason) && (
                <div className="mt-2 max-w-3xl rounded-[12px] bg-canvas px-3 py-2">
                  <ReferralDetail referral={r.referral} fallbackReason={r.referralReason} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      {queue.data?.length === CENTRE_QUEUE_SIZE && (
        <p className="mt-2 text-xs text-muted">Showing the first {CENTRE_QUEUE_SIZE}, earliest first. Decide these and the rest appear.</p>
      )}
      {approving && (
        <ApproveDialog
          pathway="centre"
          appointment={{
            publicId: approving.publicId,
            reference: approving.reference,
            appointmentDate: approving.appointmentDateTime,
            scheduledEndAt: approving.scheduledEndAt,
          }}
          onClose={() => { setApproving(null); void refresh() }}
          onDone={() => { toast(`${approving.reference} approved. The team and the centre have been notified.`); setApproving(null); void refresh() }}
        />
      )}
      {returning && (
        <ReasonDialog
          title={`Return ${returning.reference} to ${returning.centre}`}
          description="This is not a rejection. The centre sees what you need, adds it, and sends the referral again."
          label="What does the centre need to provide?"
          placeholder="Please add the patient's current medication and recent blood pressure readings."
          confirmLabel="Return to centre"
          onClose={() => setReturning(null)}
          onConfirm={async (reason) => {
            await centreApprovalsApi.returnToCentre(returning.publicId, reason)
            toast('Returned to the centre.')
            setReturning(null)
            await refresh()
          }}
        />
      )}
      {cancelling && (
        <ReasonDialog
          title={`Cancel ${cancelling.reference}`}
          description={`${cancelling.centre} and the assigned doctor are told, the room is freed, and the centre's wallet charge is returned. The centre can request another time from the same referral.`}
          label="Why is it being cancelled?"
          placeholder="The consulting doctor is unavailable. Please request another time."
          confirmLabel="Cancel consultation"
          min={5}
          onClose={() => setCancelling(null)}
          onConfirm={async (reason) => {
            const r = await centreApprovalsApi.cancel(cancelling.publicId, reason)
            toast(r.walletRefunded ? 'Cancelled. The centre’s wallet charge has been returned.' : 'Cancelled.')
            setCancelling(null)
            await refresh()
          }}
        />
      )}
    </>
  )
}
