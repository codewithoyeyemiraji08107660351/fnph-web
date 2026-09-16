import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { consultationApiFor, recordApiFor, type ConsultKind } from '@/lib/api/endpoints/clinical'
import { toApiError } from '@/lib/api/http'
import type { TerminationReason } from '@/lib/api/types'
import { formatPhone, formatTime, humanise } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { ConsultFrame } from '@/features/consult/ConsultFrame'
import { useJoinOnce } from '@/features/consult/useJoinOnce'
import { SessionClock } from '@/features/consult/SessionClock'
import { TerminateDialog } from '@/features/consult/TerminateDialog'
import { ClinicalPanel } from '@/features/consult/ClinicalPanel'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/lib/auth/AuthProvider'
import { AttachedFiles } from '@/features/files/AttachedFiles'
import { recordingApi } from '@/lib/api/endpoints/records'

export function DoctorRoom({ kind = 'fnph' }: { kind?: ConsultKind }) {
  const consultationApi = consultationApiFor(kind)
  const { can } = useAuth()
  const recordApi = recordApiFor(kind)
  useDocumentTitle('Consultation room')
  const { appointmentId = '' } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const { emergencyNumber } = usePublicSettings()
  const { session, error, retry } = useJoinOnce(appointmentId, () => consultationApi.joinAsDoctor(appointmentId))
  const consultationId = session?.consultationPublicId ?? ''
  const summary = useQuery({ queryKey: ['consultation', consultationId], queryFn: () => recordApi.summary(consultationId), enabled: Boolean(consultationId) })
  const [confirming, setConfirming] = useState(false)
  const [ending, setEnding] = useState<TerminationReason | 'ask' | null>(null)
  const [ended, setEnded] = useState<TerminationReason | null>(null)
  const [recordingNote, setRecordingNote] = useState<string | null>(null)
  const reported = useRef(false)
  // One connection report per session, FNPH rooms only. Never allowed to disturb the call.
  useEffect(() => {
    if (!session || kind !== 'fnph' || reported.current) return
    reported.current = true
    const c = (navigator as Navigator & { connection?: { rtt?: number; effectiveType?: string } }).connection
    void consultationApi.reportQuality(session.consultationPublicId, 'DOCTOR', { roundTripMs: c?.rtt, videoQuality: c?.effectiveType })
  }, [session, kind, consultationApi])
  const [pendingModality, setPendingModality] = useState<'AUDIO' | 'PHONE_FALLBACK' | 'VIDEO' | null>(null)

  if (error) {
    return (
      <div className="mx-auto max-w-xl">
        <Alert tone={error.status === 409 ? 'warning' : 'danger'} title="The room did not open">{error.message}</Alert>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={retry}>Try again</button>
          <Link to="/clinical" className="btn btn-secondary no-underline">Back to my consultations</Link>
        </div>
      </div>
    )
  }
  if (!session) return <Spinner label="Opening the room" />

  const identityConfirmed = Boolean(summary.data?.identityConfirmed)
  const alreadyEnded = Boolean(summary.data?.endedAt) || ended !== null
  const currentModality = summary.data?.modality ?? 'VIDEO'

  const refreshSummary = () => qc.invalidateQueries({ queryKey: ['consultation', consultationId] })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/clinical" className="text-sm font-bold no-underline"><i aria-hidden className="bi bi-arrow-left" /> My consultations</Link>
          {kind === 'centre' && summary.data?.centreName && (
            <p className="mt-2 text-sm font-bold text-gold-700">
              Centre consultation: {summary.data.patientName} at {summary.data.centreName}. The patient is with centre staff.
            </p>
          )}
          <h1 className="mt-1 text-2xl font-extrabold">
            Consultation {formatTime(session.scheduledStart)} to {formatTime(session.scheduledEnd)} WAT
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={currentModality === 'VIDEO' ? 'green' : 'gold'}>{humanise(currentModality)}</Badge>
          {identityConfirmed ? <Badge tone="green">Identity confirmed</Badge> : <Badge tone="gold">Identity not confirmed</Badge>}
        </div>
      </div>

      {ended === 'EMERGENCY' && (
        <Alert tone="danger" title="Emergency recorded">
          Follow the hospital escalation now. Clinical emergency line: <a className="font-bold" href={`tel:${emergencyNumber}`}>{formatPhone(emergencyNumber)}</a>.
        </Alert>
      )}
      {alreadyEnded && ended !== 'EMERGENCY' && <Alert tone="info" title="This session has ended">Complete the record below.</Alert>}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          {!alreadyEnded && (
            <SessionClock start={session.scheduledStart} end={session.scheduledEnd} firstWarningMinutes={session.firstWarningMinutes} secondWarningMinutes={session.secondWarningMinutes} />
          )}
          {!alreadyEnded && currentModality !== 'PHONE_FALLBACK' && <ConsultFrame roomUrl={session.roomUrl} token={session.token} title="Consultation video" />}
          {!alreadyEnded && currentModality === 'PHONE_FALLBACK' && (
            <Panel><p className="text-sm">Continuing by telephone, off the platform. Record the call in the note.</p></Panel>
          )}
          {!alreadyEnded && (
            <Panel title="Session controls">
              <div className="flex flex-wrap gap-2">
                {currentModality !== 'AUDIO' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPendingModality('AUDIO')}>Switch to audio only</button>}
                {currentModality !== 'VIDEO' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPendingModality('VIDEO')}>Back to video</button>}
                {currentModality !== 'PHONE_FALLBACK' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPendingModality('PHONE_FALLBACK')}>Continue by telephone</button>}
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setEnding('ask')}>End early</button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <button type="button" className="btn btn-quiet btn-sm" onClick={async () => {
                  try { await recordingApi.start(consultationId, ''); setRecordingNote('Recording started.') }
                  catch (err) { setRecordingNote(toApiError(err).message) }
                }}><i aria-hidden className="bi bi-record-circle" /> Record this session</button>
                {recordingNote && <span className="text-xs text-muted">{recordingNote}</span>}
              </div>
              <p className="mt-3 text-xs text-muted">Joining late does not extend the session. Arriving late as a clinician is allowed; the patient’s window closes at the cut-off.</p>
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          {kind === 'centre' && summary.data?.referralReason && (
            <Panel title="Referral from the centre">
              <p className="text-sm whitespace-pre-line">{summary.data.referralReason}</p>
              <p className="mt-2 text-xs text-muted">This is the only clinical context the centre sent. The patient has no FNPH record on this pathway.</p>
            </Panel>
          )}
          {can('upload.read') && (
            <Panel title="Files sent for this appointment">
              <AttachedFiles referenceId={appointmentId} />
            </Panel>
          )}
          {!identityConfirmed && !alreadyEnded ? (
            <Panel title="Confirm who you are speaking to">
              <p className="text-sm text-muted">Check the patient on screen against the record in front of you before anything clinical. The record opens once you confirm.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={confirming}
                  onClick={async () => {
                    setConfirming(true)
                    try {
                      await consultationApi.confirmIdentity(consultationId)
                      await refreshSummary()
                      toast('Identity confirmed.')
                    } catch (err) {
                      toast(toApiError(err).message, 'error')
                    } finally {
                      setConfirming(false)
                    }
                  }}
                >
                  {confirming ? <Spinner label="Recording" inverted /> : 'Identity confirmed'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEnding('FAILED_IDENTITY_VERIFICATION')}>
                  Cannot confirm, end the session
                </button>
              </div>
            </Panel>
          ) : (
            <ClinicalPanel consultationId={consultationId} kind={kind} />
          )}
        </div>
      </div>

      {pendingModality && (
        <ReasonDialog
          title={pendingModality === 'VIDEO' ? 'Return to video' : pendingModality === 'AUDIO' ? 'Switch to audio only' : 'Continue by telephone'}
          description={pendingModality === 'PHONE_FALLBACK' ? 'The session continues off the platform. This is recorded, and the note is still written here.' : 'Recorded on the consultation.'}
          label="Why?"
          placeholder={pendingModality === 'VIDEO' ? 'Connection recovered.' : 'Video kept freezing on the patient’s side.'}
          confirmLabel="Switch"
          min={5}
          onClose={() => setPendingModality(null)}
          onConfirm={async (reason) => {
            await consultationApi.switchModality(consultationId, pendingModality, reason)
            await refreshSummary()
            setPendingModality(null)
            toast('Modality recorded.')
          }}
        />
      )}
      {ending && (
        <TerminateDialog
          consultationId={consultationId}
          initialReason={ending === 'ask' ? undefined : ending}
          onClose={() => setEnding(null)}
          onEnded={(reason) => {
            setEnding(null)
            setEnded(reason)
            void refreshSummary()
          }}
        />
      )}
    </div>
  )
}
