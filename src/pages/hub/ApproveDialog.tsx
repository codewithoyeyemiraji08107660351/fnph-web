import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { approvalsApi } from '@/lib/api/endpoints/hub'
import { centreApprovalsApi } from '@/lib/api/endpoints/centre'
import { toApiError } from '@/lib/api/http'
import type { StaffOption } from '@/lib/api/types'
import { formatDateTime, formatTime, watDate } from '@/lib/format'
import { choiceLabel, doctorChoices } from './doctorChoices'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextAreaField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { IntakeSummary } from '@/features/patient/IntakeSummary'
import { VitalsList } from '@/pages/clinical/VitalsList'

const TEAM: Array<{
  key: 'nursePublicId' | 'pharmacistPublicId' | 'laboratoryTechnicianPublicId' | 'himOfficerPublicId'
  role: string
  label: string
  warning: string
}> = [
  {
    key: 'nursePublicId',
    role: 'NURSING',
    label: 'Nurse',
    warning:
      'Without a nurse, nobody verifies the vitals or prepares the room, and preparation cannot be completed.',
  },
  {
    key: 'himOfficerPublicId',
    role: 'HIM',
    label: 'Records (HIM) officer',
    warning:
      'Without a records officer, the paper record is not pulled for the doctor.',
  },
  {
    key: 'pharmacistPublicId',
    role: 'PHARMACIST',
    label: 'Pharmacist',
    warning:
      'Without a pharmacist, any prescription from this consultation has nobody to review it and the release stalls.',
  },
  {
    key: 'laboratoryTechnicianPublicId',
    role: 'LABORATORY_TECHNICIAN',
    label: 'Laboratory technician',
    warning:
      'Without a technician, any investigation request has nobody to review it and the release stalls.',
  },
]

export interface ApprovableItem {
  publicId: string
  reference: string
  appointmentDate: string
  /** Absent on the centre queue, which lists the start only. */
  scheduledEndAt?: string
}

export function ApproveDialog({
  appointment,
  onClose,
  onDone,
  pathway = 'fnph',
}: {
  appointment: ApprovableItem
  onClose: () => void
  onDone: () => void
  pathway?: 'fnph' | 'centre'
}) {
  const centre = pathway === 'centre'
  const serviceDate = watDate(appointment.appointmentDate)

  const availability = useQuery({
    queryKey: ['availability', serviceDate],
    queryFn: () => approvalsApi.availability(serviceDate),
  })

  // Each pathway has its own rooms. Offering the other kind gets refused by the server with no useful reason.
  const roomType = centre ? 'CENTRE_CONSULTATION' : 'PATIENT_SERVICE'

  const rooms = useQuery({
    queryKey: ['rooms', roomType],
    queryFn: () => approvalsApi.rooms(roomType),
  })

  const staff = useQuery({
    queryKey: ['assignable-staff'],
    queryFn: () => approvalsApi.staff(),
  })

  const [doctor, setDoctor] = useState('')
  const [room, setRoom] = useState('')
  const [team, setTeam] = useState({
    nursePublicId: '',
    pharmacistPublicId: '',
    laboratoryTechnicianPublicId: '',
    himOfficerPublicId: '',
  })
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  // Any active doctor, like the rest of the team. Doctors marked unavailable
  // for the slot are shown but cannot be chosen; the rota no longer gates.
  const doctors = useMemo(
    () => doctorChoices(staff.data, availability.data, appointment.appointmentDate, appointment.scheduledEndAt),
    [staff.data, availability.data, appointment.appointmentDate, appointment.scheduledEndAt],
  )
  const choosable = doctors.filter((d) => !d.unavailable)

  const byRole = (code: string): StaffOption[] =>
    (staff.data ?? []).filter((s) => s.roles.includes(code))

  const loading =
    availability.isLoading || rooms.isLoading || staff.isLoading

  const loadError =
    availability.error ?? rooms.error ?? staff.error

  const submit = async () => {
    setBusy(true)
    setError(null)

    try {
      if (centre) {
        // Query parameters, and the team fields spelled differently again. No nurse:
        // the centre provides the physical presence.
        await centreApprovalsApi.approve(appointment.publicId, {
          doctorPublicId: doctor,
          roomPublicId: room,
          pharmacistPublicId: team.pharmacistPublicId || undefined,
          laboratoryPublicId:
            team.laboratoryTechnicianPublicId || undefined,
          himPublicId: team.himOfficerPublicId || undefined,
          notes: notes.trim() || undefined,
        })
      } else {
        await approvalsApi.approve(appointment.publicId, {
          doctorPublicId: doctor,
          roomPublicId: room,
          nursePublicId: team.nursePublicId || undefined,
          pharmacistPublicId: team.pharmacistPublicId || undefined,
          laboratoryTechnicianPublicId:
            team.laboratoryTechnicianPublicId || undefined,
          himOfficerPublicId: team.himOfficerPublicId || undefined,
          notes: notes.trim() || undefined,
        })
      }

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
      description={
        centre
          ? `${formatDateTime(appointment.appointmentDate)} WAT. Approving draws the centre booking charge from the centre's wallet and notifies everyone assigned.`
          : `${formatDateTime(appointment.appointmentDate)} to ${formatTime(appointment.scheduledEndAt)} WAT. Approving spends the patient's payment and notifies everyone assigned.`
      }
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || failed || !doctor || !room}
          >
            {busy ? (
              <Spinner label="Approving" inverted />
            ) : (
              'Approve and notify'
            )}
          </button>
        </>
      }
    >
      {loading && (
        <Spinner label="Loading the rota, rooms and staff" />
      )}

      {!centre && (
        <>
          <IntakeSummary appointmentId={appointment.publicId} />

          <section className="mt-5 rounded-[14px] border border-line bg-white p-4">
            <div className="mb-3">
              <h3 className="font-display font-extrabold">
                Patient vitals
              </h3>

              <p className="text-sm text-muted">
                Patient-reported vital-sign readings for this appointment.
              </p>
            </div>

            <VitalsList
              appointmentPublicId={appointment.publicId}
              readOnly
            />
          </section>
        </>
      )}

      {loadError && (
        <Alert tone="danger" className="mb-4">
          {toApiError(loadError).message}
        </Alert>
      )}

      {error && (
        <Alert
          tone="danger"
          className="mb-4"
          title="Not approved"
        >
          {error} Close this and reload the queue to see the appointment's
          current state before trying again.
        </Alert>
      )}

      {!loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <SelectField
              label="Doctor"
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              required
            >
              <option value="">
                {choosable.length
                  ? 'Choose a doctor'
                  : 'No doctor can take this slot'}
              </option>

              {doctors.map((d) => (
                <option
                  key={d.publicId}
                  value={d.publicId}
                  disabled={d.unavailable}
                >
                  {choiceLabel(d)}
                </option>
              ))}
            </SelectField>

            {staff.data && doctors.length === 0 && (
              <p className="field-error">
                No active account holds the doctor role. An administrator can
                grant it.
              </p>
            )}

            {doctors.length > 0 && choosable.length === 0 && (
              <p className="field-error">
                Every doctor is marked unavailable for this slot. Change it in
                Doctor rota, or return the request for another time.
              </p>
            )}
          </div>

          <SelectField
            label="Consultation room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            required
          >
            <option value="">Choose a room</option>

            {rooms.data?.map((r) => (
              <option key={r.publicId} value={r.publicId}>
                {r.name} ({r.code})
              </option>
            ))}
          </SelectField>

          <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <legend className="mb-2 font-display font-extrabold">
              Care team
            </legend>

            {TEAM.filter(
              (t) => !(centre && t.key === 'nursePublicId'),
            ).map((t) => (
              <div key={t.key}>
                <SelectField
                  label={t.label}
                  value={team[t.key]}
                  onChange={(e) =>
                    setTeam((v) => ({
                      ...v,
                      [t.key]: e.target.value,
                    }))
                  }
                >
                  <option value="">Not assigned</option>

                  {byRole(t.role).map((s) => (
                    <option
                      key={s.publicId}
                      value={s.publicId}
                    >
                      {s.fullName}
                    </option>
                  ))}
                </SelectField>

                {!team[t.key] && (
                  <p className="mt-1 text-xs text-gold-700">
                    {t.warning}
                  </p>
                )}
              </div>
            ))}
          </fieldset>

          <TextAreaField
            wrapperClassName="sm:col-span-2"
            label="Notes for the team (optional)"
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      )}
    </Dialog>
  )
}