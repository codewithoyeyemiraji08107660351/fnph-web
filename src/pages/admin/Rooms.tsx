import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { schedulingApi } from '@/lib/api/endpoints/operations'
import { toApiError } from '@/lib/api/http'
import type { RoomOption } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const TYPE_LABEL: Record<RoomOption['roomType'], string> = {
  PATIENT_SERVICE: 'FNPH patient consultations',
  CENTRE_CONSULTATION: 'Centre consultations',
  CONTINGENCY: 'Contingency, for a room that fails mid-session',
}

export function Rooms() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const rooms = useQuery({ queryKey: ['admin-rooms'], queryFn: () => schedulingApi.rooms() })
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ code: '', name: '', roomType: 'PATIENT_SERVICE' as RoomOption['roomType'], capacityNotes: '' })
  const [closing, setClosing] = useState<RoomOption | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-rooms'] })

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.code.trim() || !f.name.trim()) return setError('Code and name are required.')
    setBusy(true)
    setError(null)
    try {
      await schedulingApi.addRoom({ code: f.code.trim(), name: f.name.trim(), roomType: f.roomType, capacityNotes: f.capacityNotes.trim() || undefined })
      toast('Room added. Days built from now on include it.')
      setAdding(false)
      setF({ code: '', name: '', roomType: 'PATIENT_SERVICE', capacityNotes: '' })
      await refresh()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  const close = async () => {
    if (!closing) return
    setBusy(true)
    setError(null)
    try {
      const r = await schedulingApi.deactivateRoom(closing.publicId)
      toast(`${r.roomCode} is out of service. ${r.openSlotsClosed} open slots closed.${r.bookedSlotsToMove ? ` ${r.bookedSlotsToMove} booked slots need moving.` : ''}`, r.bookedSlotsToMove ? 'info' : 'success')
      setClosing(null)
      await refresh()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader kicker="Scheduling" title="Consultation rooms" description="Rooms are capacity, not reference data. Every active room adds one slot per period to each day built for its audience."
        actions={can('room.manage') && <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><i aria-hidden className="bi bi-plus-lg" /> Add a room</button>} />
      <Panel bodyClassName="">
        {rooms.isLoading && <div className="p-5"><Spinner /></div>}
        {rooms.isError && <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />}
        {rooms.data?.length === 0 && <EmptyState icon="bi-door-closed" title="No active rooms">Nothing can be scheduled until a room exists.</EmptyState>}
        <ul className="divide-y divide-line">
          {rooms.data?.map((r) => (
            <li key={r.publicId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <span>
                <span className="block font-bold">{r.name} <span className="font-normal text-muted">{r.code}</span></span>
                <span className="block text-xs text-muted">{r.capacityNotes}</span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={r.roomType === 'CENTRE_CONSULTATION' ? 'gold' : r.roomType === 'CONTINGENCY' ? 'grey' : 'navy'}>{humanise(r.roomType)}</Badge>
                {can('room.manage') && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setClosing(r)}>Take out of service</button>}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      {adding && (
        <Dialog open onClose={() => setAdding(false)} busy={busy} title="Add a room"
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button><button type="submit" form="add-room" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Adding" inverted /> : 'Add room'}</button></>}>
          <form id="add-room" onSubmit={add} noValidate className="grid gap-4 sm:grid-cols-2">
            {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
            <TextField label="Code" placeholder="CR4" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
            <TextField label="Name" placeholder="Consultation Room 4" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <SelectField wrapperClassName="sm:col-span-2" label="Used for" value={f.roomType} onChange={(e) => setF({ ...f, roomType: e.target.value as RoomOption['roomType'] })}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </SelectField>
            <TextField wrapperClassName="sm:col-span-2" label="Notes (optional)" placeholder="Two chairs, quiet, good light" value={f.capacityNotes} onChange={(e) => setF({ ...f, capacityNotes: e.target.value })} />
          </form>
        </Dialog>
      )}
      {closing && (
        <Dialog open onClose={() => setClosing(null)} busy={busy} title={`Take ${closing.name} out of service?`}
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setClosing(null)} disabled={busy}>Cancel</button><button type="button" className="btn btn-danger" onClick={close} disabled={busy}>{busy ? <Spinner label="Working" inverted /> : 'Take out of service'}</button></>}>
          {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
          <p className="text-sm">This reduces capacity. Open future slots in this room are closed straight away, so they can no longer be booked, and days built later leave it out.</p>
          <p className="mt-3 text-sm">Appointments already held or booked in this room keep it. You will be told how many, and they need to be moved to another room.</p>
        </Dialog>
      )}
    </>
  )
}
