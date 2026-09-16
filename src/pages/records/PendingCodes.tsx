import { useQuery } from '@tanstack/react-query'
import { patientRecordsApi } from '@/lib/api/endpoints/records'
import { formatTime } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

export function PendingCodes() {
  const list = useQuery({ queryKey: ['pending-codes'], queryFn: patientRecordsApi.pendingCodes, refetchInterval: 30_000 })
  return (
    <>
      <PageHeader kicker="Enrolment desk" title="Patients waiting for a code" description="People enrolling at a desk because the hospital has no email for them. The code itself is never shown here." />
      <Alert tone="info" className="mb-5">There is no way to release a code from this screen yet. The service does not provide one. Confirm the patient’s identity in person and use the agreed desk procedure.</Alert>
      <Panel bodyClassName="">
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} />}
        {list.data?.length === 0 && <EmptyState icon="bi-hourglass" title="Nobody is waiting" />}
        <ul className="divide-y divide-line">
          {list.data?.map((c) => (
            <li key={c.publicId} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
              <span className="font-bold">EHR {c.ehrNumber} <span className="font-normal text-muted">{c.destinationMasked}</span></span>
              <span className="text-muted">Expires {formatTime(c.expiresAt)}. {c.attempts} attempt{c.attempts === 1 ? '' : 's'}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
