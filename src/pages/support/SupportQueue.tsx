import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supportApi, type Ticket } from '@/lib/api/endpoints/support'
import { adminApi } from '@/lib/api/endpoints/admin'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, formatRelative, humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextAreaField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { TicketStatusBadge, TicketThread } from './TicketThread'

// Only roles that can open the support queue. The server accepts any role, but
// escalating to one without ticket.read notifies people who cannot see the ticket.
const ESCALATE_TO = ['ICT_SUPPORT', 'HELPDESK', 'CENTRAL_ADMINISTRATOR']

function TicketPanel({ ticket, onChanged }: { ticket: Ticket; onChanged: () => void }) {
  const { can } = useAuth()
  const toast = useToast()
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'assign' | 'escalate' | 'resolve' | null>(null)
  const [agent, setAgent] = useState('')
  const [toRole, setToRole] = useState('ICT_SUPPORT')
  const agents = useQuery({
    queryKey: ['helpdesk-agents'],
    queryFn: async () => (await adminApi.users.list({ status: 'ACTIVE', size: 200 })).filter((u) => u.roles.some((r) => r === 'HELPDESK' || r === 'ICT_SUPPORT')),
    enabled: dialog === 'assign',
  })
  const closed = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      toast(done)
      setDialog(null)
      onChanged()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-4 border-t border-line bg-canvas/50 px-5 py-4">
      <TicketThread ticket={ticket} />
      {error && <Alert tone="danger">{error}</Alert>}
      {!closed && can('ticket.respond') && (
        <div>
          <TextAreaField label="Reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={internal} onChange={(e) => setInternal(e.target.checked)} />Internal note (the requester does not see it)</label>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !reply.trim()} onClick={() => act(async () => { await supportApi.reply(ticket.publicId, reply.trim(), internal); setReply('') }, internal ? 'Note added.' : 'Reply sent.')}>
              {internal ? 'Add note' : 'Send reply'}
            </button>
          </div>
        </div>
      )}
      {!closed && (
        <div className="flex flex-wrap gap-2">
          {can('ticket.assign') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog('assign')}>Assign</button>}
          {can('ticket.escalate') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog('escalate')}>Escalate</button>}
          {can('ticket.close') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog('resolve')}>Resolve</button>}
        </div>
      )}
      {dialog === 'assign' && (
        <Dialog open onClose={() => setDialog(null)} busy={busy} title={`Assign ${ticket.ticketNumber}`}
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy || !agent} onClick={() => act(() => supportApi.assign(ticket.publicId, agent), 'Assigned.')}>Assign</button></>}>
          <SelectField label="To" value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">{agents.isLoading ? 'Loading' : 'Choose a person'}</option>
            {agents.data?.map((u) => <option key={u.publicId} value={u.publicId}>{u.fullName}</option>)}
          </SelectField>
        </Dialog>
      )}
      {dialog === 'escalate' && (
        <ReasonDialog title={`Escalate ${ticket.ticketNumber}`} label="Why" confirmLabel="Escalate" min={5}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => { await supportApi.escalate(ticket.publicId, toRole, reason); toast('Escalated.'); setDialog(null); onChanged() }}>
          <SelectField wrapperClassName="mb-4" label="To which team" value={toRole} onChange={(e) => setToRole(e.target.value)}>
            {ESCALATE_TO.map((r) => <option key={r} value={r}>{humanise(r)}</option>)}
          </SelectField>
        </ReasonDialog>
      )}
      {dialog === 'resolve' && (
        <ReasonDialog title={`Resolve ${ticket.ticketNumber}`} label="What fixed it" confirmLabel="Resolve" min={5}
          description="The requester sees this summary."
          onClose={() => setDialog(null)}
          onConfirm={async (summary) => { await supportApi.resolve(ticket.publicId, summary); toast('Resolved.'); setDialog(null); onChanged() }} />
      )}
    </div>
  )
}

export function SupportQueue() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'queue' | 'breaches'>('queue')
  const list = useQuery({ queryKey: ['support-queue', tab], queryFn: () => (tab === 'queue' ? supportApi.queue() : supportApi.breaches()), refetchInterval: 60_000 })
  const [open, setOpen] = useState<string | null>(null)
  return (
    <>
      <PageHeader kicker="Support" title="Support queue" description="Requests from patients, centres and staff, oldest first. Breaches are past their response target." />
      <div className="mb-4 flex gap-2">
        <button type="button" aria-pressed={tab === 'queue'} className={`btn btn-sm ${tab === 'queue' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('queue')}>Open requests</button>
        <button type="button" aria-pressed={tab === 'breaches'} className={`btn btn-sm ${tab === 'breaches' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('breaches')}>Breaches</button>
      </div>
      <Panel bodyClassName="">
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {list.data?.length === 0 && <EmptyState icon="bi-inbox" title={tab === 'queue' ? 'Queue is clear' : 'No breaches'} />}
        <ul className="divide-y divide-line">
          {list.data?.map((t) => (
            <li key={t.publicId}>
              <button type="button" aria-expanded={open === t.publicId} onClick={() => setOpen(open === t.publicId ? null : t.publicId)} className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left hover:bg-soft/60">
                <span>
                  <span className="block font-bold">{t.subject}</span>
                  <span className="block text-xs text-muted">{t.ticketNumber}. {humanise(t.category)}. Opened {formatRelative(t.createdAt)} ({formatDateTime(t.createdAt)}){t.escalatedToRole ? `. With ${humanise(t.escalatedToRole)}` : ''}</span>
                </span>
                <span className="flex items-center gap-2">
                  {(t.priority === 'HIGH' || t.priority === 'URGENT') && <Badge tone="red">{humanise(t.priority)}</Badge>}
                  <TicketStatusBadge status={t.status} />
                </span>
              </button>
              {open === t.publicId && <TicketPanel ticket={t} onChanged={() => void qc.invalidateQueries({ queryKey: ['support-queue'] })} />}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
