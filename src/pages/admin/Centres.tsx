import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { centresAdminApi, type CapabilityState } from '@/lib/api/endpoints/operations'
import { toApiError } from '@/lib/api/http'
import type { CentreRow } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

function Capabilities({ centre }: { centre: CentreRow }) {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const caps = useQuery({ queryKey: ['capabilities', centre.publicId], queryFn: () => centresAdminApi.capabilities(centre.publicId) })
  const [changing, setChanging] = useState<CapabilityState | null>(null)
  if (caps.isLoading) return <Spinner />
  if (caps.isError) return <ErrorState error={caps.error} />
  return (
    <>
      <ul className="space-y-2">
        {caps.data?.map((c) => (
          <li key={c.capability} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-line px-3 py-2 text-sm">
            <span>
              <strong>{humanise(c.capability)}</strong> <span className="text-muted">unlocks {humanise(c.unlocksRole)}</span>
              {c.enabled && c.enabledBy && <span className="block text-xs text-muted">On since {formatDateTime(c.enabledAt)} by {c.enabledBy}</span>}
              {!c.enabled && c.disableReason && <span className="block text-xs text-muted">Off: {c.disableReason}</span>}
            </span>
            <span className="flex items-center gap-2">
              {c.enabled ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}
              {can('centre_capability.manage') && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setChanging(c)}>{c.enabled ? 'Switch off' : 'Switch on'}</button>}
            </span>
          </li>
        ))}
      </ul>
      {changing && (
        <ReasonDialog
          title={`${changing.enabled ? 'Switch off' : 'Switch on'} ${humanise(changing.capability).toLowerCase()} at ${centre.name}`}
          description={changing.enabled ? `Staff with the ${humanise(changing.unlocksRole)} role at this centre lose access to it.` : `Staff with the ${humanise(changing.unlocksRole)} role at this centre gain access to it.`}
          confirmLabel={changing.enabled ? 'Switch off' : 'Switch on'}
          danger={changing.enabled}
          onClose={() => setChanging(null)}
          onConfirm={async (reason) => {
            await centresAdminApi.setCapability(centre.publicId, changing.capability, !changing.enabled, reason)
            toast('Capability updated.')
            setChanging(null)
            await qc.invalidateQueries({ queryKey: ['capabilities', centre.publicId] })
          }}
        />
      )}
    </>
  )
}

export function Centres() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const list = useQuery({ queryKey: ['admin', 'centres'], queryFn: centresAdminApi.list })
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [statusFor, setStatusFor] = useState<{ centre: CentreRow; status: 'ACTIVE' | 'SUSPENDED' } | null>(null)
  const [f, setF] = useState({ code: '', name: '', lga: '', address: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'centres'] })

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.code.trim() || !f.name.trim()) return setError('Code and name are required.')
    setBusy(true)
    setError(null)
    try {
      await centresAdminApi.create({ code: f.code.trim(), name: f.name.trim(), lga: f.lga.trim() || undefined, address: f.address.trim() || undefined })
      toast('Centre created in setup. Activate it when it is ready to refer.')
      setCreating(false)
      await refresh()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader kicker="Centres of Excellence" title="Centres" description="Only an active centre can refer patients. Services such as pharmacy run only where switched on."
        actions={can('centre.create') && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><i aria-hidden className="bi bi-plus-lg" /> Add a centre</button>} />
      <Panel bodyClassName="">
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {list.data?.length === 0 && <EmptyState icon="bi-buildings" title="No centres yet" />}
        <ul className="divide-y divide-line">
          {list.data?.map((c) => (
            <li key={c.publicId} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="text-left" aria-expanded={open === c.publicId} onClick={() => setOpen(open === c.publicId ? null : c.publicId)}>
                  <span className="block font-bold">{c.name} <span className="font-normal text-muted">{c.code}</span></span>
                  <span className="block text-xs text-muted">{c.lga}{c.suspendReason ? `. Suspended: ${c.suspendReason}` : ''}</span>
                </button>
                <span className="flex items-center gap-2">
                  <Badge tone={c.status === 'ACTIVE' ? 'green' : c.status === 'SUSPENDED' ? 'red' : 'gold'}>{humanise(c.status)}</Badge>
                  {can('centre.activate') && c.status !== 'ACTIVE' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatusFor({ centre: c, status: 'ACTIVE' })}>Activate</button>}
                  {can('centre.activate') && c.status === 'ACTIVE' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatusFor({ centre: c, status: 'SUSPENDED' })}>Suspend</button>}
                </span>
              </div>
              {open === c.publicId && <div className="mt-3"><Capabilities centre={c} /></div>}
            </li>
          ))}
        </ul>
      </Panel>
      {creating && (
        <Dialog open onClose={() => setCreating(false)} busy={busy} title="Add a centre" description="It starts in setup: staff can be invited, but it cannot refer until activated."
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setCreating(false)}>Cancel</button><button type="submit" form="add-centre" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Adding" inverted /> : 'Add centre'}</button></>}>
          <form id="add-centre" onSubmit={create} noValidate className="grid gap-4 sm:grid-cols-2">
            {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
            <TextField label="Code" placeholder="KDN-N" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
            <TextField label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <TextField label="LGA (optional)" value={f.lga} onChange={(e) => setF({ ...f, lga: e.target.value })} />
            <TextField label="Address (optional)" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </form>
        </Dialog>
      )}
      {statusFor && (
        <ReasonDialog
          title={`${statusFor.status === 'ACTIVE' ? 'Activate' : 'Suspend'} ${statusFor.centre.name}`}
          description={statusFor.status === 'ACTIVE' ? 'The centre can refer patients and request consultations.' : 'The centre stops referring. Consultations already approved are not cancelled by this.'}
          confirmLabel={statusFor.status === 'ACTIVE' ? 'Activate' : 'Suspend'}
          danger={statusFor.status === 'SUSPENDED'}
          onClose={() => setStatusFor(null)}
          onConfirm={async (reason) => {
            await centresAdminApi.setStatus(statusFor.centre.publicId, statusFor.status, reason)
            toast(statusFor.status === 'ACTIVE' ? 'Centre activated.' : 'Centre suspended.')
            setStatusFor(null)
            await refresh()
          }}
        />
      )}
    </>
  )
}
