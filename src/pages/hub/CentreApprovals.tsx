import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { centreApprovalsApi } from '@/lib/api/endpoints/centre'
import type { CentreApprovalRow } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, formatRelative } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { ApproveDialog } from './ApproveDialog'

export function CentreApprovals() {
  const { appointmentId } = useParams()
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const queue = useQuery({ queryKey: ['centre-approvals'], queryFn: centreApprovalsApi.queue, refetchInterval: 60_000 })
  const [approving, setApproving] = useState<CentreApprovalRow | null>(null)
  const [returning, setReturning] = useState<CentreApprovalRow | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['centre-approvals'] })
  return (
    <>
      <PageHeader
        kicker="Hub coordination"
        title="Centre requests"
        description="Consultations requested by Centres of Excellence. Approve with a doctor and a centre consultation room, or return the request to the centre with what is needed."
      />
      <Panel bodyClassName="">
        {queue.isLoading && <div className="p-5"><Spinner /></div>}
        {queue.isError && <ErrorState error={queue.error} onRetry={() => queue.refetch()} />}
        {queue.data?.length === 0 && <EmptyState icon="bi-buildings" title="No centre requests waiting" />}
        <ul className="divide-y divide-line">
          {queue.data?.map((r) => (
            <li key={r.publicId} className={`px-5 py-4 ${r.publicId === appointmentId ? 'bg-accent-soft/60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-extrabold">{formatDateTime(r.appointmentDateTime)} WAT <span className="text-sm font-normal text-muted">({formatRelative(r.appointmentDateTime)})</span></p>
                  <p className="font-bold">{r.patient} <span className="font-normal text-muted">at {r.centre}</span></p>
                  <p className="text-xs text-muted">{r.reference}</p>
                </div>
                <div className="flex gap-2">
                  {can('appointment.reject') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReturning(r)}>Return to centre</button>}
                  {can('appointment.approve') && <button type="button" className="btn btn-primary btn-sm" onClick={() => setApproving(r)}>Approve</button>}
                </div>
              </div>
              {r.referralReason && <p className="mt-2 max-w-3xl rounded-[12px] bg-canvas px-3 py-2 text-sm whitespace-pre-line">{r.referralReason}</p>}
            </li>
          ))}
        </ul>
      </Panel>
      {approving && (
        <ApproveDialog
          pathway="centre"
          appointment={{ publicId: approving.publicId, reference: approving.reference, appointmentDate: approving.appointmentDateTime }}
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
    </>
  )
}
