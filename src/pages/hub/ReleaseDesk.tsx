import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { releaseApi } from '@/lib/api/endpoints/hub'
import type { ReleaseDeskRow } from '@/lib/api/types'
import { formatDateTime, formatRelative, humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'

const FILTERS: Array<{ value: ReleaseDeskRow['status'] | ''; label: string }> = [
  { value: '', label: 'All unreleased' },
  { value: 'READY', label: 'Ready to release' },
  { value: 'INCOMPLETE', label: 'Waiting on a component' },
  { value: 'BLOCKED', label: 'Blocked' },
]

export function BundleStatusBadge({ status }: { status: string }) {
  if (status === 'READY') return <Badge tone="green">Ready</Badge>
  if (status === 'BLOCKED') return <Badge tone="red">Blocked</Badge>
  if (status === 'RELEASED') return <Badge tone="navy">Released</Badge>
  return <Badge tone="gold">Incomplete</Badge>
}

export function ReleaseDesk() {
  const [status, setStatus] = useState<ReleaseDeskRow['status'] | ''>('')
  const desk = useQuery({ queryKey: ['release-desk', status], queryFn: () => releaseApi.desk(status || undefined), refetchInterval: 60_000 })
  const ready = desk.data?.filter((r) => r.status === 'READY').length ?? 0

  return (
    <>
      <PageHeader
        kicker="Hub coordination"
        title="Release desk"
        description="Completed consultations waiting to reach the patient. Oldest first, because the wait is theirs. Release sends every document at once."
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.label} type="button" role="tab" aria-selected={status === f.value} onClick={() => setStatus(f.value)} className={`btn btn-sm ${status === f.value ? 'btn-primary' : 'btn-secondary'}`}>
            {f.label}
          </button>
        ))}
      </div>
      <Panel bodyClassName="">
        {desk.isLoading && <div className="p-5"><Spinner label="Loading bundles" /></div>}
        {desk.isError && <ErrorState error={desk.error} onRetry={() => desk.refetch()} />}
        {desk.data?.length === 0 && <EmptyState icon="bi-send-check" title="Nothing waiting">Bundles appear here once a consultation note is signed.</EmptyState>}
        {!!desk.data?.length && (
          <>
            {!status && <p className="border-b border-line px-5 py-3 text-sm text-muted">{desk.data.length} unreleased. {ready} ready now.</p>}
            <div className="overflow-x-auto">
              <table className="table-base min-w-[760px]">
                <thead>
                  <tr><th>Patient</th><th>Consultation</th><th>State</th><th>Waiting on</th><th><span className="sr-only">Open</span></th></tr>
                </thead>
                <tbody>
                  {desk.data.map((r) => (
                    <tr key={r.publicId} className="hover:bg-soft/60">
                      <td>
                        <p className="font-bold">{r.patientName}</p>
                        <p className="text-xs text-muted">EHR {r.ehrNumber}</p>
                      </td>
                      <td className="text-sm">
                        {formatDateTime(r.appointmentDate)}
                        <span className="block text-xs text-muted">{r.appointmentReference}{r.doctorName ? `, ${r.doctorName}` : ''}</span>
                      </td>
                      <td><BundleStatusBadge status={r.status} /><span className="mt-1 block text-xs text-muted">opened {formatRelative(r.createdAt)}</span></td>
                      <td className="text-sm">
                        {r.status === 'BLOCKED' ? <span className="text-alarm">{r.blockedReason}</span> : r.outstanding.length ? r.outstanding.map(humanise).join(', ') : <span className="text-muted">Nothing</span>}
                      </td>
                      <td className="text-right">
                        <Link to={`/hub/releases/${encodeURIComponent(r.publicId)}`} className={`btn btn-sm no-underline ${r.status === 'READY' ? 'btn-primary' : 'btn-secondary'}`}>
                          {r.status === 'READY' ? 'Review and release' : 'Open'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </>
  )
}
