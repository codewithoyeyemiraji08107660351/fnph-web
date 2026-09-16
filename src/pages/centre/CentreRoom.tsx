import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { legacyCentreJoinApi } from '@/lib/api/endpoints/records'
import { consultationApiFor } from '@/lib/api/endpoints/clinical'
import { ConsultFrame } from '@/features/consult/ConsultFrame'
import { useJoinOnce } from '@/features/consult/useJoinOnce'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { formatPhone, formatTime } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

const api = consultationApiFor('centre')

/**
  The third kind of room. Centre staff attend with the patient; the FNPH
  clinician owns the call. No clock and no termination controls here,
  because neither belongs to this user.
*/
export function CentreRoom() {
  useDocumentTitle('Centre consultation')
  const { appointmentId = '' } = useParams()
  const { emergencyNumber } = usePublicSettings()
  const { session, error, retry } = useJoinOnce(appointmentId, () => api.joinAsCentre(appointmentId))
  // When the room is not open yet, show what the appointment is so staff can prepare.
  const details = useQuery({ queryKey: ['centre-join-details', appointmentId], queryFn: () => legacyCentreJoinApi.details(appointmentId), enabled: error?.status === 409, retry: false })
  if (error) {
    return (
      <div className="mx-auto max-w-xl">
        <Alert tone={error.status === 409 ? 'warning' : 'danger'} title="The room is not open">{error.message}</Alert>
        {details.data && (
          <p className="mt-3 text-sm text-muted">
            {details.data.reference}, {formatTime(details.data.appointmentDateTime)} WAT{details.data.room && details.data.room !== 'null' ? `, ${details.data.room}` : ''}. {details.data.note}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button type="button" className="btn btn-primary" onClick={retry}>Try again</button>
          <Link to="/centre/consultations" className="btn btn-secondary no-underline">Back to consultations</Link>
        </div>
      </div>
    )
  }
  if (!session) return <Spinner label="Joining the room" />
  return (
    <div className="space-y-4">
      <div>
        <Link to="/centre/consultations" className="text-sm font-bold no-underline"><i aria-hidden className="bi bi-arrow-left" /> Consultations</Link>
        <h1 className="mt-1 text-2xl font-extrabold">Consultation {formatTime(session.scheduledStart)} to {formatTime(session.scheduledEnd)} WAT</h1>
        <p className="text-sm text-muted">The FNPH doctor admits you, runs the session and ends it.</p>
      </div>
      <ConsultFrame roomUrl={session.roomUrl} token={session.token} title="Centre consultation video" />
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <p className="rounded-[14px] bg-white p-4"><strong className="block">Patient present</strong><span className="text-muted">Seat the patient where the doctor can see and hear them, away from others.</span></p>
        <p className="rounded-[14px] bg-white p-4"><strong className="block">Identity</strong><span className="text-muted">The doctor confirms who the patient is before starting. Have their details to hand.</span></p>
        <p className="rounded-[14px] bg-blush p-4 text-alarm-700"><strong className="block">Emergency</strong>Follow your centre’s emergency procedure. FNPH clinical line: <a className="font-bold text-alarm-700" href={`tel:${emergencyNumber}`}>{formatPhone(emergencyNumber)}</a></p>
      </div>
    </div>
  )
}
