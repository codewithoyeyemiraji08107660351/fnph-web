import { useQuery } from '@tanstack/react-query'
import { releaseApi } from '@/lib/api/endpoints/hub'
import { formatDateTime, humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'

export function ReviewQueries() {
  const queries = useQuery({ queryKey: ['review-queries'], queryFn: releaseApi.queries })
  return (
    <>
      <PageHeader
        kicker="Hub coordination"
        title="Review queries"
        description="Concerns pharmacy and laboratory raised while reviewing. The documents still moved forward; take each concern to the doctor or the multidisciplinary team, and block the bundle if it must wait."
      />
      <Panel bodyClassName="">
        {queries.isLoading && <div className="p-5"><Spinner label="Loading queries" /></div>}
        {queries.isError && <ErrorState error={queries.error} onRetry={() => queries.refetch()} />}
        {queries.data?.length === 0 && <EmptyState icon="bi-chat-square-text" title="No open queries" />}
        <ul className="divide-y divide-line">
          {queries.data?.map((q) => (
            <li key={q.publicId} className="px-5 py-4">
              <p className="font-bold">{humanise(q.documentType)} {q.issueNumber}</p>
              <p className="text-xs text-muted">{humanise(q.reviewType)} review, submitted {formatDateTime(q.submittedAt)}</p>
              <p className="mt-2 rounded-[12px] bg-amber-note px-3 py-2 text-sm">{q.queryDetail}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
