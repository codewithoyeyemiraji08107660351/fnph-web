import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { patientRecordsApi } from '@/lib/api/endpoints/records'
import { formatDateTime } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

export function Drift() {
  const qc = useQueryClient()
  const toast = useToast()
  const list = useQuery({ queryKey: ['drift'], queryFn: () => patientRecordsApi.drift() })
  const [clearing, setClearing] = useState<{ publicId: string; name: string } | null>(null)
  return (
    <>
      <PageHeader kicker="Hospital records" title="Record mismatches" description="Patients whose online record no longer agrees with the latest hospital export. Check the paper record, correct what is wrong, then clear the flag." />
      <Panel bodyClassName="">
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} />}
        {list.data?.length === 0 && <EmptyState icon="bi-check2-all" title="No mismatches" />}
        <ul className="divide-y divide-line">
          {list.data?.map((d) => (
            <li key={d.publicId} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
              <span><span className="block font-bold">{d.name} <span className="font-normal text-muted">EHR {d.ehrNumber}</span></span>
                <span className="block text-xs text-muted">Flagged {formatDateTime(d.flaggedAt)}</span>
                {d.details && <span className="mt-1 block">{d.details}</span>}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setClearing({ publicId: d.publicId, name: d.name })}>Clear</button>
            </li>
          ))}
        </ul>
      </Panel>
      {clearing && (
        <ReasonDialog title={`Clear the mismatch for ${clearing.name}`} label="What was checked" min={5} confirmLabel="Clear"
          onClose={() => setClearing(null)}
          onConfirm={async (notes) => { await patientRecordsApi.clearDrift(clearing.publicId, notes); toast('Cleared.'); setClearing(null); await qc.invalidateQueries({ queryKey: ['drift'] }) }} />
      )}
    </>
  )
}
