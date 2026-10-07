import { useQuery } from '@tanstack/react-query'

import { oversightApi } from '@/lib/api/endpoints/hub'
import type { EditRevisionRow } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'

import { EmptyState, ErrorState, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'

import { FIELD_LABEL, oversightKeys } from './oversight'

const TARGET_LABEL: Record<EditRevisionRow['targetType'], string> = {
  REVIEW: 'Review',
  FOLLOW_UP: 'Follow-up',
}

/** Rows arrive newest first; one save shares an editGroup. */
function grouped(rows: EditRevisionRow[]) {
  const groups = new Map<string, EditRevisionRow[]>()
  for (const row of rows) {
    const list = groups.get(row.editGroup)
    if (list) list.push(row)
    else groups.set(row.editGroup, [row])
  }
  return [...groups.values()]
}

function Value({ value, struck }: { value?: string | null; struck?: boolean }) {
  if (!value) return <span className="italic text-muted">empty</span>
  return <span className={`whitespace-pre-wrap ${struck ? 'text-muted line-through' : ''}`}>{value}</span>
}

export function EditHistoryPanel({ appointmentPublicId }: { appointmentPublicId: string }) {
  const edits = useQuery({
    queryKey: oversightKeys.edits(appointmentPublicId),
    queryFn: () => oversightApi.edits(appointmentPublicId),
  })

  return (
    <Panel title="Edit history" className="mt-5" bodyClassName="">
      {edits.isLoading && (
        <div className="p-5">
          <Spinner label="Loading edit history" />
        </div>
      )}

      {edits.isError && <ErrorState error={edits.error} onRetry={() => edits.refetch()} />}

      {edits.isSuccess && edits.data.length === 0 && (
        <EmptyState icon="bi-clock-history" title="No edits">
          Reviews and follow-ups on this consultation are as their authors left them.
        </EmptyState>
      )}

      {!!edits.data?.length && (
        <ol className="divide-y divide-line">
          {grouped(edits.data).map((group) => {
            const head = group[0]
            return (
              <li key={head.editGroup} className="px-5 py-4">
                <p className="text-sm">
                  <span className="font-bold">{head.editedBy}</span> edited a{' '}
                  {TARGET_LABEL[head.targetType].toLowerCase()}
                  <span className="text-muted"> · {formatDateTime(head.editedAt)}</span>
                </p>
                <p className="mt-1 text-sm text-muted">Reason: {head.reason}</p>
                <dl className="mt-3 space-y-2">
                  {group.map((row) => (
                    <div key={row.revisionPublicId} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                      <dt className="text-xs font-bold uppercase tracking-wide text-muted">
                        {FIELD_LABEL[row.fieldName] ?? row.fieldName}
                      </dt>
                      <dd className="mt-1 grid gap-1 sm:grid-cols-[auto_1fr]">
                        <span className="text-xs text-muted">Before</span>
                        <Value value={row.oldValue} struck />
                        <span className="text-xs text-muted">After</span>
                        <Value value={row.newValue} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
