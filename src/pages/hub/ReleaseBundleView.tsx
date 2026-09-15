import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { releaseApi } from '@/lib/api/endpoints/hub'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, humanise } from '@/lib/format'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { TextAreaField } from '@/components/ui/Field'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Dialog } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { BundleStatusBadge } from './ReleaseDesk'

export function ReleaseBundleView() {
  const { bundleId = '' } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()
  const bundle = useQuery({ queryKey: ['bundle', bundleId], queryFn: () => releaseApi.get(bundleId) })
  const [notes, setNotes] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (bundle.isLoading) return <Spinner label="Loading bundle" />
  if (bundle.isError || !bundle.data) return <ErrorState error={bundle.error} onRetry={() => bundle.refetch()} />
  const b = bundle.data
  const outstanding = b.components.filter((c) => c.outstanding)
  const released = b.status === 'RELEASED'

  const update = (next: typeof b) => {
    qc.setQueryData(['bundle', bundleId], next)
    void qc.invalidateQueries({ queryKey: ['release-desk'] })
  }

  const release = async () => {
    setBusy(true)
    setError(null)
    try {
      update(await releaseApi.release(b.publicId, notes.trim() || undefined))
      toast('Released. The patient has been notified.')
      setConfirming(false)
    } catch (err) {
      setError(toApiError(err).message)
      setConfirming(false)
      void bundle.refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Link to="/hub/releases" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold no-underline">
        <i aria-hidden className="bi bi-arrow-left" /> Release desk
      </Link>
      <PageHeader kicker="Release bundle" title="Review and release" actions={<BundleStatusBadge status={b.status} />} />
      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}
      {b.status === 'BLOCKED' && b.blockedReason && <Alert tone="danger" className="mb-5" title="Blocked">{b.blockedReason}</Alert>}
      {released && <Alert tone="success" className="mb-5" title="Released">By {b.releasedBy} on {formatDateTime(b.releasedAt)}.</Alert>}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Components" bodyClassName="">
          <ul className="divide-y divide-line">
            {b.components.map((c) => (
              <li key={c.componentType} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-bold">{humanise(c.componentType)}</p>
                  {c.notRequired && <p className="text-sm text-muted">Doctor recorded this as not needed: {c.notRequiredReason ?? 'no reason given'}</p>}
                </div>
                {c.complete ? <Badge tone="green">Done</Badge> : c.notRequired ? <Badge>Not required</Badge> : c.outstanding ? <Badge tone="gold">Outstanding</Badge> : <Badge tone="navy">In progress</Badge>}
              </li>
            ))}
          </ul>
        </Panel>
        {!released && (
          <Panel title="Decision">
            <p className="text-sm text-muted">
              This is an administrative check: every component is done or recorded as not needed. It is not a clinical review, and nothing here changes the documents.
            </p>
            {outstanding.length > 0 && (
              <Alert tone="warning" className="mt-4">Still waiting on {outstanding.map((c) => humanise(c.componentType)).join(', ')}. Chase the named reviewer, or block with a reason.</Alert>
            )}
            <TextAreaField wrapperClassName="mt-4" label="Release notes (optional)" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="mt-4 flex flex-wrap gap-2">
              {can('release_bundle.release') && (
                <>
                  <button type="button" className="btn btn-primary" disabled={busy || outstanding.length > 0} onClick={() => setConfirming(true)}>
                    {b.status === 'BLOCKED' ? 'Lift the block and release' : 'Release everything'}
                  </button>
                  {b.status !== 'BLOCKED' && (
                    <button type="button" className="btn btn-secondary" onClick={() => setBlocking(true)}>
                      Block
                    </button>
                  )}
                </>
              )}
            </div>
          </Panel>
        )}
      </div>

      {confirming && (
        <Dialog
          open
          onClose={() => setConfirming(false)}
          busy={busy}
          title="Release to the patient?"
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={release} disabled={busy}>{busy ? <Spinner label="Releasing" inverted /> : 'Release now'}</button>
            </>
          }
        >
          {b.status === 'BLOCKED' && <Alert tone="warning" className="mb-3">It was blocked because: {b.blockedReason}. Confirm that concern is resolved.</Alert>}
          <p className="text-sm">Every document in this bundle becomes available to the patient at once, and they are notified. A released bundle cannot be withdrawn; a correction needs a superseding document from the doctor.</p>
        </Dialog>
      )}
      {blocking && (
        <ReasonDialog
          title="Block this bundle"
          description="Nothing reaches the patient while it is blocked. Say what is wrong, for whoever picks this up next."
          label="Reason"
          placeholder="Pharmacist raised a dose query. Holding for the multidisciplinary team."
          confirmLabel="Block"
          danger
          onClose={() => setBlocking(false)}
          onConfirm={async (reason) => {
            update(await releaseApi.block(b.publicId, reason))
            toast('Bundle blocked.')
            setBlocking(false)
          }}
        />
      )}
    </>
  )
}
