import { useQuery } from '@tanstack/react-query'
import { centreApi } from '@/lib/api/endpoints/centre'
import { EmptyState, ErrorState } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { Incoming } from './Incoming'

const COPY = {
  PHARMACY: { title: 'Pharmacy', description: 'Released prescriptions for patients seen at this centre.' },
  LABORATORY: { title: 'Laboratory', description: 'Released investigation requests for patients seen at this centre.' },
  HIM: { title: 'Records', description: 'Released care bundles to file against the centre’s patient records.' },
} as const

/** A wrong link to a service this centre does not run is not a security event. */
export function CapabilityWorkspace({ capability }: { capability: keyof typeof COPY }) {
  const me = useQuery({ queryKey: ['centre-me'], queryFn: centreApi.me })
  if (me.isLoading) return <Spinner />
  if (me.isError) return <ErrorState error={me.error} onRetry={() => me.refetch()} />
  const enabled = me.data?.capabilities.some((c) => c.capability === capability && c.enabled)
  if (!enabled) {
    return (
      <div className="card">
        <EmptyState icon="bi-slash-circle" title={`This centre does not run ${COPY[capability].title.toLowerCase()} services`}>
          FNPH Central Administration switches services on per centre. Ask them if this should be running here.
        </EmptyState>
      </div>
    )
  }
  return <Incoming title={COPY[capability].title} description={COPY[capability].description} />
}
