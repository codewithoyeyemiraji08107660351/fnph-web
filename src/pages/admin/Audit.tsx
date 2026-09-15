import { Fragment, useState, type FormEvent } from 'react'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { adminApi, type AuditSearch } from '@/lib/api/endpoints/admin'
import { toApiError } from '@/lib/api/http'
import type { AuditEntry } from '@/lib/api/types'
import { formatDateTime, humanise, serverToWatInput, watInputToServer } from '@/lib/format'
import { useAuth } from '@/lib/auth/AuthProvider'
import { EmptyState, ErrorState, PageHeader, Pager, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { TextField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { Dialog } from '@/components/ui/Dialog'

const PAGE_SIZE = 50

function outcomeBadge(outcome?: string) {
  if (!outcome) return null
  const o = outcome.toUpperCase()
  if (o.includes('SUCCESS') || o === 'OK' || o === 'ALLOWED') return <Badge tone="green">{humanise(outcome)}</Badge>
  if (o.includes('DENIED') || o.includes('FAIL') || o.includes('REJECT')) return <Badge tone="red">{humanise(outcome)}</Badge>
  return <Badge>{humanise(outcome)}</Badge>
}

function SupervisionTrail({ sessionId, onClose }: { sessionId: number; onClose: () => void }) {
  const trail = useQuery({ queryKey: ['admin', 'audit', 'trail', sessionId], queryFn: () => adminApi.supervision.trail(sessionId) })
  return (
    <Dialog open onClose={onClose} size="lg" title="Supervised session trail" description="Every request made while this supervised session was open.">
      {trail.isLoading && <Spinner label="Loading trail" />}
      {trail.isError && <ErrorState error={trail.error} />}
      <ol className="space-y-3">
        {trail.data?.map((e) => (
          <li key={e.publicId} className="rounded-[12px] border border-line px-4 py-3 text-sm">
            <p className="font-bold">{humanise(e.action)}</p>
            <p className="text-xs text-muted">{formatDateTime(e.performedAt)}. {e.entityType ? humanise(e.entityType) : ''}</p>
          </li>
        ))}
      </ol>
    </Dialog>
  )
}

export function Audit() {
  const { can } = useAuth()
  const now = new Date()
  const [draft, setDraft] = useState({ action: '', entityType: '', from: serverToWatInput(new Date(now.getTime() - 7 * 86400_000)), to: '' })
  const [filters, setFilters] = useState<AuditSearch>({ from: watInputToServer(draft.from) })
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const [trail, setTrail] = useState<number | null>(null)

  const audit = useQuery({
    queryKey: ['admin', 'audit', filters, page],
    queryFn: () => adminApi.audit.search({ ...filters, page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const verify = useMutation({ mutationFn: adminApi.audit.verify })

  const apply = (e: FormEvent) => {
    e.preventDefault()
    setPage(0)
    setFilters({
      action: draft.action.trim().toUpperCase() || undefined,
      entityType: draft.entityType.trim() || undefined,
      from: watInputToServer(draft.from),
      to: watInputToServer(draft.to),
    })
  }

  const data = audit.data
  const rows: AuditEntry[] = data?.content ?? []

  return (
    <>
      <PageHeader
        kicker="Governance"
        title="Audit log"
        description="Append-only record of access, supervision, approvals, clinical amendments, financial postings, downloads and configuration changes. Times are WAT."
        actions={
          can('audit.export') && (
            <button className="btn btn-secondary" onClick={() => verify.mutate()} disabled={verify.isPending}>
              {verify.isPending ? <Spinner label="Verifying" /> : <><i aria-hidden className="bi bi-link-45deg" /> Verify integrity</>}
            </button>
          )
        }
      />

      {verify.isError && <Alert tone="danger" className="mb-5">{toApiError(verify.error).message}</Alert>}
      {verify.data && (
        <Alert tone={verify.data.intact ? 'success' : 'danger'} title={verify.data.intact ? 'Audit chain intact' : 'Audit chain broken'} className="mb-5">
          {verify.data.entriesChecked.toLocaleString('en-NG')} entries checked.
          {!verify.data.intact && (
            <ul className="mt-2 list-disc pl-5">
              {verify.data.breaks.slice(0, 10).map((b, i) => (
                <li key={i}>{b.description} {b.performedAt ? `(${formatDateTime(b.performedAt)})` : ''}</li>
              ))}
            </ul>
          )}
          {!verify.data.intact && <p className="mt-2 font-bold">Treat this as a security incident. Preserve the database and inform ICT and management.</p>}
        </Alert>
      )}

      <Panel bodyClassName="">
        <form onSubmit={apply} className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end">
          <TextField label="Action" placeholder="For example LOGIN" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} autoCapitalize="characters" />
          <TextField label="Record type" placeholder="For example Users" value={draft.entityType} onChange={(e) => setDraft({ ...draft, entityType: e.target.value })} />
          <TextField label="From (WAT)" type="datetime-local" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          <TextField label="To (WAT, blank for now)" type="datetime-local" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          <button type="submit" className="btn btn-primary">Apply filters</button>
        </form>

        {audit.isLoading && <div className="p-5"><Spinner label="Loading audit entries" /></div>}
        {audit.isError && <ErrorState error={audit.error} onRetry={() => audit.refetch()} />}
        {data && rows.length === 0 && <EmptyState icon="bi-journal" title="No entries in this range">Widen the dates or clear a filter. With no dates, the last 30 days are searched.</EmptyState>}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className={`table-base min-w-[860px] ${audit.isPlaceholderData ? 'opacity-60' : ''}`}>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Who</th>
                  <th scope="col">Action</th>
                  <th scope="col">Record</th>
                  <th scope="col">Outcome</th>
                  <th scope="col"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <Fragment key={e.publicId}>
                    <tr className="hover:bg-soft/60">
                      <td className="text-sm whitespace-nowrap">{formatDateTime(e.performedAt)}</td>
                      <td className="text-sm">
                        <span className="font-bold">{e.systemAction ? 'System' : e.username ?? 'Unknown'}</span>
                        {e.viewAsSessionId && (
                          <button type="button" className="mt-1 block" onClick={() => setTrail(e.viewAsSessionId as number)}>
                            <Badge tone="gold">Supervising {e.effectivePrincipal ?? ''}</Badge>
                          </button>
                        )}
                      </td>
                      <td className="text-sm"><code className="text-xs">{e.action}</code></td>
                      <td className="text-sm text-muted">{e.entityType ? `${humanise(e.entityType)}${e.entityId ? ` #${e.entityId}` : ''}` : ''}</td>
                      <td>{outcomeBadge(e.outcome)}</td>
                      <td className="text-right">
                        {(e.details || e.reason || e.ipAddress) && (
                          <button type="button" className="btn btn-quiet btn-sm" aria-expanded={open === e.publicId} onClick={() => setOpen(open === e.publicId ? null : e.publicId)}>
                            {open === e.publicId ? 'Hide' : 'Details'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {open === e.publicId && (
                      <tr className="bg-soft/50">
                        <td colSpan={6}>
                          <dl className="grid gap-3 text-sm md:grid-cols-3">
                            {e.reason && <div><dt className="text-xs text-muted">Reason</dt><dd>{e.reason}</dd></div>}
                            {e.ipAddress && <div><dt className="text-xs text-muted">IP address</dt><dd className="font-mono">{e.ipAddress}</dd></div>}
                            {e.details && (
                              <div className="md:col-span-3">
                                <dt className="text-xs text-muted">Details</dt>
                                <dd><pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-white p-3 text-xs whitespace-pre-wrap">{e.details}</pre></dd>
                              </div>
                            )}
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.totalPages > 1 && (
          <Pager
            page={page}
            hasNext={!data.last}
            onChange={setPage}
            summary={`Page ${data.number + 1} of ${data.totalPages}. ${data.totalElements.toLocaleString('en-NG')} entries.`}
          />
        )}
      </Panel>
      {trail !== null && <SupervisionTrail sessionId={trail} onClose={() => setTrail(null)} />}
    </>
  )
}
