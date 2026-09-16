import { useQuery } from '@tanstack/react-query'
import { ictApi } from '@/lib/api/endpoints/operations'
import { formatDateTime } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'

export function Quarantine() {
  const list = useQuery({ queryKey: ['quarantined'], queryFn: ictApi.quarantined })
  return (
    <>
      <PageHeader kicker="Security" title="Quarantined uploads" description="Files held back because a scan flagged them or they were quarantined by hand. They are not served to anyone." />
      <Panel bodyClassName="">
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} />}
        {list.data?.length === 0 && <EmptyState icon="bi-shield-check" title="Nothing quarantined" />}
        <ul className="divide-y divide-line">
          {list.data?.map((u) => (
            <li key={u.publicId} className="px-5 py-3 text-sm">
              <p className="font-bold">{u.originalFileName}</p>
              <p className="text-xs text-muted">Uploaded {formatDateTime(u.uploadedAt)} by {u.uploadedBy}. {u.scanResult}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
