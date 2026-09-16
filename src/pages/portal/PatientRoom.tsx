import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { consultationApi } from '@/lib/api/endpoints/clinical'
import { ConsultFrame } from '@/features/consult/ConsultFrame'
import { useJoinOnce } from '@/features/consult/useJoinOnce'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { formatPhone, formatTime } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'

export function PatientRoom() {
  useDocumentTitle('Your consultation')
  const { appointmentId = '' } = useParams()
  const { emergencyNumber } = usePublicSettings()
  const { session, error, retry } = useJoinOnce(appointmentId, () => consultationApi.joinAsPatient(appointmentId))
  const reported = useRef(false)
  useEffect(() => {
    if (!session || reported.current) return
    reported.current = true
    const c = (navigator as Navigator & { connection?: { rtt?: number; effectiveType?: string } }).connection
    void consultationApi.reportQuality(session.consultationPublicId, 'PATIENT', { roundTripMs: c?.rtt, videoQuality: c?.effectiveType })
  }, [session])

  if (error) {
    return (
      <div className="mx-auto max-w-xl">
        <Alert tone={error.status === 409 ? 'warning' : 'danger'} title="The room is not open">
          {error.message}
        </Alert>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={retry}>Try again</button>
          <Link to="/portal/appointments" className="btn btn-secondary no-underline">Back to appointments</Link>
        </div>
        <p className="mt-6 text-sm text-muted">
          In an emergency, call <a href={`tel:${emergencyNumber}`} className="font-bold">{formatPhone(emergencyNumber)}</a>.
        </p>
      </div>
    )
  }
  if (!session) return <Spinner label="Connecting you to the room" />

  // No countdown for the patient. The clinician manages the time.
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="kicker">Your consultation</span>
          <h1 className="text-2xl font-extrabold">
            {formatTime(session.scheduledStart)} to {formatTime(session.scheduledEnd)} WAT
          </h1>
        </div>
        <p className="text-sm text-muted">The doctor will confirm who you are before starting.</p>
      </div>
      <ConsultFrame roomUrl={session.roomUrl} token={session.token} title="Video consultation" />
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <p className="rounded-[14px] bg-white p-4"><strong className="block">Somewhere private</strong><span className="text-muted">A quiet room where nobody can overhear.</span></p>
        <p className="rounded-[14px] bg-white p-4"><strong className="block">Connection drops?</strong><span className="text-muted">Reopen this page. The doctor may switch to audio or call you.</span></p>
        <p className="rounded-[14px] bg-blush p-4 text-alarm-700"><strong className="block">Emergency</strong>Call <a className="font-bold text-alarm-700" href={`tel:${emergencyNumber}`}>{formatPhone(emergencyNumber)}</a></p>
      </div>
    </div>
  )
}
