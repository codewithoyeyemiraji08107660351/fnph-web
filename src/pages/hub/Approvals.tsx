import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { approvalsApi } from '@/lib/api/endpoints/hub'
import type { Appointment } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, formatRelative, humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { ApproveDialog } from './ApproveDialog'

function HistoryDialog({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const history = useQuery({ queryKey: ['approval-history', appointment.publicId], queryFn: () => approvalsApi.history(appointment.publicId) })
  return (
    <Dialog open onClose={onClose} title={`History of ${appointment.reference}`}>
      {history.isLoading && <Spinner label="Loading" />}
      {history.isError && <ErrorState error={history.error} />}
      <ol className="space-y-3 border-l-2 border-line pl-4">
        {history.data?.map((h, i) => (
          <li key={i} className="text-sm">
            <p className="font-bold">{humanise(h.toStatus)}</p>
            <p className="text-xs text-muted">{formatDateTime(h.changedAt)} {h.changedBy && `by ${h.changedBy}`}</p>
            {h.reason && <p className="text-muted">{h.reason}</p>}
          </li>
        ))}
      </ol>
    </Dialog>
  )
}

export function Approvals() {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()
  const queue = useQuery({ queryKey: ['approvals'], queryFn: () => approvalsApi.queue(), refetchInterval: 60_000 })
  const [approving, setApproving] = useState<Appointment | null>(null)
  const [rejecting, setRejecting] = useState<Appointment | null>(null)
  const [history, setHistory] = useState<Appointment | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['approvals'] })
  const close = () => {
    if (appointmentId) navigate('/hub/approvals', { replace: true })
  }

  return (
    <>
      <PageHeader
        kicker="Hub coordination"
        title="Awaiting approval"
        description="Paid requests, earliest first. Approve with a doctor, a room and the care team, or reject with a reason the patient will see."
        actions={<button type="button" className="btn btn-secondary" onClick={refresh}><i aria-hidden className="bi bi-arrow-clockwise" /> Reload</button>}
      />
      <Panel bodyClassName="">
        {queue.isLoading && <div className="p-5"><Spinner label="Loading the queue" /></div>}
        {queue.isError && <ErrorState error={queue.error} onRetry={() => queue.refetch()} />}
        {queue.data?.appointments.length === 0 && <EmptyState icon="bi-inbox" title="Nothing waiting">Paid requests appear here as soon as payment is confirmed.</EmptyState>}
        {!!queue.data?.appointments.length && (
          <>
            <p className="border-b border-line px-5 py-3 text-sm text-muted">{queue.data.total} waiting</p>
            <ul className="divide-y divide-line">
              {queue.data.appointments.map((a) => (
                <li key={a.publicId} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${a.publicId === appointmentId ? 'bg-accent-soft/60' : ''}`}>
                  <div>
                    <p className="font-display font-extrabold">{formatDateTime(a.appointmentDate)} WAT</p>
                    <p className="text-sm text-muted">{a.reference}. Requested time starts {formatRelative(a.appointmentDate)}.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => setHistory(a)}>History</button>
                    {can('appointment.reject') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRejecting(a)}>Reject</button>}
                    {can('appointment.approve') && <button type="button" className="btn btn-primary btn-sm" onClick={() => setApproving(a)}>Approve</button>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {approving && (
        <ApproveDialog
          appointment={approving}
          onClose={() => {
            setApproving(null)
            close()
            void refresh()
          }}
          onDone={() => {
            toast(`${approving.reference} approved. The team has been notified.`)
            setApproving(null)
            close()
            void refresh()
          }}
        />
      )}
      {rejecting && (
        <ReasonDialog
          title={`Reject ${rejecting.reference}`}
          description="The patient is shown this reason, and their payment stays on their account as credit. Write it for them."
          label="Reason the patient will see"
          placeholder="No doctor is available at this time. Please choose another day."
          confirmLabel="Reject request"
          danger
          onClose={() => setRejecting(null)}
          onConfirm={async (reason) => {
            await approvalsApi.reject(rejecting.publicId, reason)
            toast(`${rejecting.reference} rejected. The patient has been told.`)
            setRejecting(null)
            close()
            await refresh()
          }}
        />
      )}
      {history && <HistoryDialog appointment={history} onClose={() => setHistory(null)} />}
    </>
  )
}
