import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { schedulingApi } from '@/lib/api/endpoints/operations'
import { adminApi } from '@/lib/api/endpoints/admin'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { DISPLAY_TIME_ZONE, formatCalendarDate, formatTime, watInputToServer } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const watDay = (offset: number) => new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE }).format(new Date(Date.now() + offset * 86_400_000))

export function Rota() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [date, setDate] = useState(watDay(1))
  const [adding, setAdding] = useState(false)
  const rota = useQuery({ queryKey: ['rota', date], queryFn: () => schedulingApi.availability(date) })
  const doctors = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => (await adminApi.users.list({ status: 'ACTIVE', size: 200 })).filter((u) => u.roles.includes('DOCTOR')),
    enabled: adding,
  })
  const [f, setF] = useState({ doctor: '', start: '09:00', end: '13:00', available: true, reason: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.doctor) return setError('Choose a doctor.')
    if (f.end <= f.start) return setError('The window must end after it starts.')
    if (!f.available && !f.reason.trim()) return setError('Say why the doctor is unavailable. Coordinators see this reason.')
    setBusy(true)
    setError(null)
    try {
      await schedulingApi.setAvailability({
        doctorPublicId: f.doctor,
        serviceDate: date,
        // Entered in WAT, sent as UTC. The date must agree with the times, which it does because both are the same WAT day.
        startAt: watInputToServer(`${date}T${f.start}`)!,
        endAt: watInputToServer(`${date}T${f.end}`)!,
        available: f.available,
        reason: f.reason.trim() || undefined,
      })
      toast('Rota updated.')
      setAdding(false)
      await qc.invalidateQueries({ queryKey: ['rota', date] })
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader kicker="Scheduling" title="Doctor rota" description="Who is available when. A Hub Coordinator is only offered doctors whose window covers the whole appointment."
        actions={can('doctor_availability.manage') && <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><i aria-hidden className="bi bi-plus-lg" /> Add to rota</button>} />
      <div className="mb-5 max-w-xs"><TextField label="Day" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <Panel title={formatCalendarDate(date)} bodyClassName="">
        {rota.isLoading && <div className="p-5"><Spinner /></div>}
        {rota.isError && <ErrorState error={rota.error} onRetry={() => rota.refetch()} />}
        {rota.data?.length === 0 && <EmptyState icon="bi-person-badge" title="Nobody on the rota">Coordinators cannot approve appointments on this day until a doctor is added.</EmptyState>}
        <ul className="divide-y divide-line">
          {rota.data?.map((a) => (
            <li key={a.publicId} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span>
                <span className="block font-bold">{a.doctor}</span>
                <span className="block text-xs text-muted">{formatTime(a.startAt)} to {formatTime(a.endAt)} WAT{a.reason ? `. ${a.reason}` : ''}</span>
              </span>
              {a.available ? <Badge tone="green">Available</Badge> : <Badge tone="red">Unavailable</Badge>}
            </li>
          ))}
        </ul>
      </Panel>
      {adding && (
        <Dialog open onClose={() => setAdding(false)} busy={busy} title={`Rota for ${formatCalendarDate(date)}`}
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button><button type="submit" form="rota-form" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Saving" inverted /> : 'Save'}</button></>}>
          <form id="rota-form" onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
            {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
            <SelectField wrapperClassName="sm:col-span-2" label="Doctor" value={f.doctor} onChange={(e) => setF({ ...f, doctor: e.target.value })}>
              <option value="">{doctors.isLoading ? 'Loading doctors' : 'Choose a doctor'}</option>
              {doctors.data?.map((d) => <option key={d.publicId} value={d.publicId}>{d.fullName}</option>)}
            </SelectField>
            <TextField label="From (WAT)" type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
            <TextField label="Until (WAT)" type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
            <SelectField label="Status" value={f.available ? 'yes' : 'no'} onChange={(e) => setF({ ...f, available: e.target.value === 'yes' })}>
              <option value="yes">Available</option>
              <option value="no">Unavailable</option>
            </SelectField>
            <TextField label={f.available ? 'Note (optional)' : 'Reason'} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder={f.available ? '' : 'Annual leave'} />
          </form>
        </Dialog>
      )}
    </>
  )
}
