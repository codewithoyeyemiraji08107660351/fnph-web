import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { centreApi } from '@/lib/api/endpoints/centre'
import type { CentreReferral, ReferralStatus } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { ReferralStatusBadge } from './ReferralStatusBadge'
import { ConsentSubmitDialog, RequestTimeDialog } from './ReferralDialogs'

const TABS: Array<{ value: ReferralStatus | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'SUBMITTED', label: 'Sent' },
  { value: 'SCHEDULED', label: 'Requested' },
  { value: 'COMPLETED', label: 'Completed' },
]

export function Referrals() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [status, setStatus] = useState<ReferralStatus | ''>('')
  const list = useQuery({ queryKey: ['centre-referrals', status], queryFn: () => centreApi.referrals(status || undefined) })
  const [consenting, setConsenting] = useState<CentreReferral | null>(null)
  const [requesting, setRequesting] = useState<CentreReferral | null>(null)
  const refresh = () => void qc.invalidateQueries({ queryKey: ['centre-referrals'] })
  return (
    <>
      <PageHeader kicker="Centre" title="Referrals" description="Everything this centre has referred to FNPH. A returned referral needs something from you before FNPH can schedule it." />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.label} type="button" aria-pressed={status === t.value} onClick={() => setStatus(t.value)} className={`btn btn-sm ${status === t.value ? 'btn-primary' : 'btn-secondary'}`}>{t.label}</button>
        ))}
      </div>
      <Panel bodyClassName="">
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {list.data?.length === 0 && <EmptyState icon="bi-send" title="No referrals here">Refer a patient from their page.</EmptyState>}
        <div className="overflow-x-auto">
          {!!list.data?.length && (
            <table className="table-base min-w-[720px]">
              <thead><tr><th>Patient</th><th>Referral</th><th>State</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {list.data.map((r) => (
                  <tr key={r.publicId}>
                    <td className="font-bold">{r.patientName}<span className="block text-xs font-normal text-muted">{r.centrePatientId}</span></td>
                    <td className="text-sm">{r.reference}<span className="block text-xs text-muted">{r.urgency === 'SOON' ? 'Soon. ' : ''}Created {formatDateTime(r.createdAt)}</span></td>
                    <td><ReferralStatusBadge status={r.status} /></td>
                    <td className="text-right">
                      {(r.status === 'DRAFT' || r.status === 'RETURNED') && can('centre_referral.create') && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setConsenting(r)}>Take consent and send</button>
                      )}
                      {r.status === 'SUBMITTED' && can('appointment.request') && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setRequesting(r)}>Request a time</button>
                      )}
                      {r.status === 'SCHEDULED' && <Link to="/centre/consultations" className="btn btn-quiet btn-sm no-underline">Consultations</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
      {consenting && <ConsentSubmitDialog referral={consenting} onClose={() => setConsenting(null)} onDone={() => { setConsenting(null); toast('Referral sent to FNPH.'); refresh() }} />}
      {requesting && <RequestTimeDialog referral={requesting} onClose={() => setRequesting(null)} onDone={(ref) => { setRequesting(null); toast(`Request ${ref} sent. FNPH will confirm.`); refresh() }} />}
    </>
  )
}
