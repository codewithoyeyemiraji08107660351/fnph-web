import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { schedulingApi, type Audience, type Publication } from '@/lib/api/endpoints/operations'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { DISPLAY_TIME_ZONE, formatCalendarDate, formatTime, humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const watDay = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE }).format(new Date(Date.now() + offset * 86_400_000))
const AUDIENCE_LABEL: Record<Audience, string> = { FNPH_PATIENT: 'Patient days', CENTRE: 'Centre days' }

function PublishDialog({ onClose, onDone }: { onClose: () => void; onDone: (p: Publication) => void }) {
  const [f, setF] = useState({ audience: 'FNPH_PATIENT' as Audience, serviceDate: watDay(1), windowStart: '09:00', windowEnd: '16:00', open: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (f.windowEnd <= f.windowStart) return setError('The window must end after it starts.')
    setBusy(true)
    setError(null)
    try {
      onDone(await schedulingApi.publish({ audience: f.audience, serviceDate: f.serviceDate, windowStart: `${f.windowStart}:00`, windowEnd: `${f.windowEnd}:00`, publishImmediately: f.open }))
    } catch (err) {
      setError(toApiError(err).message)
      setBusy(false)
    }
  }
  return (
    <Dialog open onClose={onClose} busy={busy} title="Build a day" description="Slot length comes from configuration for each audience. One slot is created per period in every active room of the right type."
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" form="publish-day" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Building" inverted /> : f.open ? 'Build and open' : 'Build as draft'}</button></>}>
      <form id="publish-day" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
        <SelectField label="For" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as Audience })} hint="Patient and centre days are separate. One never opens the other.">
          <option value="FNPH_PATIENT">FNPH patients</option>
          <option value="CENTRE">Centres of Excellence</option>
        </SelectField>
        <TextField label="Date" type="date" min={watDay(0)} value={f.serviceDate} onChange={(e) => setF({ ...f, serviceDate: e.target.value })} />
        <TextField label="From (WAT)" type="time" value={f.windowStart} onChange={(e) => setF({ ...f, windowStart: e.target.value })} />
        <TextField label="Until (WAT)" type="time" value={f.windowEnd} onChange={(e) => setF({ ...f, windowEnd: e.target.value })} />
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={f.open} onChange={(e) => setF({ ...f, open: e.target.checked })} />
          <span>Open for booking now. Leave unticked to check the slots first; a day that is open is visible immediately, and withdrawing it later does not cancel bookings.</span>
        </label>
      </form>
    </Dialog>
  )
}

function SlotsDialog({ pub, onClose }: { pub: Publication; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const slots = useQuery({ queryKey: ['slots', pub.publicId], queryFn: () => schedulingApi.slots(pub.publicId) })
  const [blocking, setBlocking] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['slots', pub.publicId] })
  return (
    <Dialog open size="lg" onClose={onClose} title={`${AUDIENCE_LABEL[pub.audience]}: ${formatCalendarDate(pub.serviceDate)}`} description={`${pub.slotsGenerated} slots, ${pub.slotMinutes} minutes each. Times are WAT.`}>
      {slots.isLoading && <Spinner />}
      {slots.isError && <ErrorState error={slots.error} />}
      <div className="overflow-x-auto">
        <table className="table-base min-w-[520px]">
          <thead><tr><th>Time</th><th>Room</th><th>State</th><th /></tr></thead>
          <tbody>
            {slots.data?.map((s) => (
              <tr key={s.publicId}>
                <td className="whitespace-nowrap">{formatTime(s.startAt)} to {formatTime(s.endAt)}</td>
                <td>{s.room}</td>
                <td>
                  <Badge tone={s.state === 'AVAILABLE' ? 'green' : s.state === 'BLOCKED' ? 'red' : 'navy'}>{humanise(s.state)}</Badge>
                  {s.blockedReason && <span className="block text-xs text-muted">{s.blockedReason}</span>}
                </td>
                <td className="text-right">
                  {s.state === 'AVAILABLE' && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setBlocking(s.publicId)}>Block</button>}
                  {s.state === 'BLOCKED' && (
                    <button type="button" className="btn btn-quiet btn-sm" onClick={async () => { await schedulingApi.unblock(s.publicId); toast('Slot reopened.'); await refresh() }}>Unblock</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {blocking && (
        <ReasonDialog title="Block this slot" description="Taking capacity away is recorded. Unblocking needs no reason." label="Why" min={5} confirmLabel="Block slot"
          onClose={() => setBlocking(null)}
          onConfirm={async (reason) => { await schedulingApi.block(blocking, reason); toast('Slot blocked.'); setBlocking(null); await refresh() }} />
      )}
    </Dialog>
  )
}

export function Schedules() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [from, setFrom] = useState(watDay(0))
  const [to, setTo] = useState(watDay(28))
  const [publishing, setPublishing] = useState(false)
  const [viewing, setViewing] = useState<Publication | null>(null)
  const [withdrawing, setWithdrawing] = useState<Publication | null>(null)
  const list = useQuery({ queryKey: ['publications', from, to], queryFn: () => schedulingApi.list(from, to) })
  const refresh = () => qc.invalidateQueries({ queryKey: ['publications'] })

  const table = (audience: Audience) => {
    const rows = (list.data ?? []).filter((p) => p.audience === audience)
    return (
      <Panel title={AUDIENCE_LABEL[audience]} bodyClassName="" className="mb-5">
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No {audience === 'CENTRE' ? 'centre' : 'patient'} days in this range. Bookings for this audience show no times until one is opened.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((p) => (
              <li key={p.publicId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span>
                  <span className="block font-bold">{formatCalendarDate(p.serviceDate)}</span>
                  <span className="block text-xs text-muted">{p.windowStart.slice(0, 5)} to {p.windowEnd.slice(0, 5)} WAT. {p.slotsGenerated} slots of {p.slotMinutes} minutes.{p.withdrawReason ? ` Withdrawn: ${p.withdrawReason}` : ''}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={p.status === 'PUBLISHED' ? 'green' : p.status === 'DRAFT' ? 'gold' : 'grey'}>{p.status === 'PUBLISHED' ? 'Open' : humanise(p.status)}</Badge>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => setViewing(p)}>Slots</button>
                  {p.status === 'DRAFT' && can('schedule.publish') && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={async () => {
                      try { await schedulingApi.open(p.publicId); toast('Open for booking now.'); await refresh() } catch (err) { toast(toApiError(err).message, 'error') }
                    }}>Open for booking</button>
                  )}
                  {p.status === 'PUBLISHED' && can('schedule.publish') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setWithdrawing(p)}>Withdraw</button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    )
  }

  return (
    <>
      <PageHeader kicker="Scheduling" title="Consultation days" description="Nothing can be booked until a day is opened. Patient and centre days are published separately so neither can use up the other’s capacity."
        actions={can('schedule.publish') && <button type="button" className="btn btn-primary" onClick={() => setPublishing(true)}><i aria-hidden className="bi bi-calendar-plus" /> Build a day</button>} />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {list.isLoading && <Spinner />}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.data && list.data.length === 0 && <div className="card mb-5"><EmptyState icon="bi-calendar-x" title="No days in this range">Build a day to make times bookable.</EmptyState></div>}
      {list.data && table('FNPH_PATIENT')}
      {list.data && table('CENTRE')}
      {publishing && <PublishDialog onClose={() => setPublishing(false)} onDone={(p) => { setPublishing(false); toast(p.status === 'DRAFT' ? `Draft built with ${p.slotsGenerated} slots. Check it, then open it.` : `Open with ${p.slotsGenerated} slots.`); void refresh() }} />}
      {viewing && <SlotsDialog pub={viewing} onClose={() => setViewing(null)} />}
      {withdrawing && (
        <ReasonDialog title={`Withdraw ${formatCalendarDate(withdrawing.serviceDate)}`} danger confirmLabel="Withdraw day"
          description="No new bookings are taken. Appointments already booked on this day still stand and are not cancelled: contact those patients separately if they must move."
          label="Why" onClose={() => setWithdrawing(null)}
          onConfirm={async (reason) => { await schedulingApi.withdraw(withdrawing.publicId, reason); toast('Day withdrawn. Existing bookings stand.'); setWithdrawing(null); await refresh() }} />
      )}
    </>
  )
}
