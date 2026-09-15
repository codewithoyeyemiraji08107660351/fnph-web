import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { approvalsApi } from '@/lib/api/endpoints/hub'
import { toApiError } from '@/lib/api/http'
import type { Appointment, StaffOption } from '@/lib/api/types'
import { formatDateTime, formatTime, parseServerTime, watDate } from '@/lib/format'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextAreaField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

const TEAM: Array<{ key: 'nursePublicId' | 'pharmacistPublicId' | 'laboratoryTechnicianPublicId' | 'himOfficerPublicId'; role: string; label: string; warning: string }> = [
  { key: 'nursePublicId', role: 'NURSING', label: 'Nurse', warning: 'Without a nurse, nobody verifies the vitals or prepares the room, and preparation cannot be completed.' },
  { key: 'himOfficerPublicId', role: 'HIM', label: 'Records (HIM) officer', warning: 'Without a records officer, the paper record is not pulled for the doctor.' },
  { key: 'pharmacistPublicId', role: 'PHARMACIST', label: 'Pharmacist', warning: 'Without a pharmacist, any prescription from this consultation has nobody to review it and the release stalls.' },
  { key: 'laboratoryTechnicianPublicId', role: 'LABORATORY_TECHNICIAN', label: 'Laboratory technician', warning: 'Without a technician, any investigation request has nobody to review it and the release stalls.' },
]

export function ApproveDialog({ appointment, onClose, onDone }: { appointment: Appointment; onClose: () => void; onDone: () => void }) {
  const serviceDate = watDate(appointment.appointmentDate)
  const availability = useQuery({ queryKey: ['availability', serviceDate], queryFn: () => approvalsApi.availability(serviceDate) })
  const rooms = useQuery({ queryKey: ['rooms', 'PATIENT_SERVICE'], queryFn: () => approvalsApi.rooms('PATIENT_SERVICE') })
  const staff = useQuery({ queryKey: ['assignable-staff'], queryFn: () => approvalsApi.staff() })
  const [doctor, setDoctor] = useState('')
  const [room, setRoom] = useState('')
  const [team, setTeam] = useState({ nursePublicId: '', pharmacistPublicId: '', laboratoryTechnicianPublicId: '', himOfficerPublicId: '' })
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  // The server checks the rota covers the whole slot, so only those doctors are offered.
  const { eligible, unavailable } = useMemo(() => {
    const start = parseServerTime(appointment.appointmentDate)?.getTime() ?? 0
    const end = parseServerTime(appointment.scheduledEndAt)?.getTime() ?? 0
    const rows = availability.data ?? []
    const covering = rows.filter((a) => a.available && (parseServerTime(a.startAt)?.getTime() ?? Infinity) <= start && (parseServerTime(a.endAt)?.getTime() ?? 0) >= end)
    const seen = new Set<string>()
    return {
      eligible: covering.filter((a) => (seen.has(a.doctorPublicId) ? false : (seen.add(a.doctorPublicId), true))),
      unavailable: rows.filter((a) => !a.available),
    }
  }, [availability.data, appointment])

  const byRole = (code: string): StaffOption[] => (staff.data ?? []).filter((s) => s.roles.includes(code))
  const loading = availability.isLoading || rooms.isLoading || staff.isLoading
  const loadError = availability.error ?? rooms.error ?? staff.error

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await approvalsApi.approve(appointment.publicId, {
        doctorPublicId: doctor,
        roomPublicId: room,
        nursePublicId: team.nursePublicId || undefined,
        pharmacistPublicId: team.pharmacistPublicId || undefined,
        laboratoryTechnicianPublicId: team.laboratoryTechnicianPublicId || undefined,
        himOfficerPublicId: team.himOfficerPublicId || undefined,
        notes: notes.trim() || undefined,
      })
      onDone()
    } catch (err) {
      // Approval spends the patient's money. No automatic retry, and no second
      // attempt from this dialog until the queue has been reloaded.
      setError(toApiError(err).message)
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      busy={busy}
      title={`Approve ${appointment.reference}`}
      description={`${formatDateTime(appointment.appointmentDate)} to ${formatTime(appointment.scheduledEndAt)} WAT. Approving spends the patient's payment and notifies everyone assigned.`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || failed || !doctor || !room}>
            {busy ? <Spinner label="Approving" inverted /> : 'Approve and notify'}
          </button>
        </>
      }
    >
      {loading && <Spinner label="Loading the rota, rooms and staff" />}
      {loadError && <Alert tone="danger" className="mb-4">{toApiError(loadError).message}</Alert>}
      {error && (
        <Alert tone="danger" className="mb-4" title="Not approved">
          {error} Close this and reload the queue to see the appointment's current state before trying again.
        </Alert>
      )}
      {!loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <SelectField label="Doctor" value={doctor} onChange={(e) => setDoctor(e.target.value)} required>
              <option value="">{eligible.length ? 'Choose a doctor' : 'Nobody available'}</option>
              {eligible.map((a) => (
                <option key={a.doctorPublicId} value={a.doctorPublicId}>
                  {a.doctor} ({formatTime(a.startAt)} to {formatTime(a.endAt)})
                </option>
              ))}
            </SelectField>
            {availability.data && eligible.length === 0 && (
              <p className="field-error">No doctor on the {serviceDate} rota covers this whole slot. The rota needs updating before this can be approved.</p>
            )}
            {unavailable.length > 0 && (
              <details className="mt-2 text-xs text-muted">
                <summary className="cursor-pointer">{unavailable.length} marked unavailable that day</summary>
                <ul className="mt-1 space-y-0.5">
                  {unavailable.map((a) => <li key={a.publicId}>{a.doctor}{a.reason ? `: ${a.reason}` : ''}</li>)}
                </ul>
              </details>
            )}
          </div>
          <SelectField label="Consultation room" value={room} onChange={(e) => setRoom(e.target.value)} required>
            <option value="">Choose a room</option>
            {rooms.data?.map((r) => (
              <option key={r.publicId} value={r.publicId}>{r.name} ({r.code})</option>
            ))}
          </SelectField>
          <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <legend className="mb-2 font-display font-extrabold">Care team</legend>
            {TEAM.map((t) => (
              <div key={t.key}>
                <SelectField label={t.label} value={team[t.key]} onChange={(e) => setTeam((v) => ({ ...v, [t.key]: e.target.value }))}>
                  <option value="">Not assigned</option>
                  {byRole(t.role).map((s) => <option key={s.publicId} value={s.publicId}>{s.fullName}</option>)}
                </SelectField>
                {!team[t.key] && <p className="mt-1 text-xs text-gold-700">{t.warning}</p>}
              </div>
            ))}
          </fieldset>
          <TextAreaField wrapperClassName="sm:col-span-2" label="Notes for the team (optional)" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}
    </Dialog>
  )
}
