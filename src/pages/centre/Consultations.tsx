import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCentreRefresh } from '@/features/centre/useCentreRefresh'
import { centreApi } from '@/lib/api/endpoints/centre'
import type { CentreAppointmentRow } from '@/lib/api/types'
import { formatDateTime, formatTime, parseServerTime } from '@/lib/format'
import { useNow } from '@/lib/hooks/useNow'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { AppointmentBadge } from '@/components/ui/AppointmentBadge'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useToast } from '@/components/ui/Toast'
import { UploadDialog } from '@/features/files/UploadDialog'
import { VitalsDialog } from '@/features/centre/VitalsDialog'
import { ReasonDialog } from '@/components/ui/ReasonDialog'

function Row({ a, now }: { a: CentreAppointmentRow; now: number }) {
  const { can } = useAuth()
  const toast = useToast()
  const refresh = useCentreRefresh()
  const [attaching, setAttaching] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [recording, setRecording] = useState(false)
  const opens = parseServerTime(a.joinWindowOpensAt)?.getTime() ?? Infinity
  const end = parseServerTime(a.scheduledEndAt)?.getTime() ?? 0
  const live = a.status === 'APPROVED' || a.status === 'IN_PROGRESS'
  const canJoin = live && now >= opens && now < end
  const start = parseServerTime(a.appointmentDate)?.getTime() ?? 0
  const cancellable = (a.status === 'AWAITING_APPROVAL' || a.status === 'APPROVED') && now < start
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-extrabold">{formatDateTime(a.appointmentDate)} WAT</p>
          <p className="font-bold">{a.patientName} <span className="font-normal text-muted">{a.centrePatientId}</span></p>
          <p className="text-xs text-muted">{a.reference}{a.referralReference ? `. Referral ${a.referralReference}` : ''}{a.room ? `. ${a.room}` : ''}</p>
        </div>
        {/* A returned request comes back REJECTED on the appointment; for the centre it is a request for more, not a refusal. */}
        {a.status === 'REJECTED' ? <Badge tone="gold">Returned by FNPH</Badge> : <AppointmentBadge status={a.status} />}
      </div>
      {a.returnedReason && <p className="mt-2 rounded-[12px] bg-amber-note px-3 py-2 text-sm text-gold-700">FNPH asked: {a.returnedReason}</p>}
      {a.status === 'CANCELLED' && a.cancellationReason && <p className="mt-2 rounded-[12px] bg-canvas px-3 py-2 text-sm">Cancelled: {a.cancellationReason.replace(/\.$/, '')}. Request another time from the referral.</p>}
      {a.status === 'EXPIRED' && <p className="mt-2 rounded-[12px] bg-canvas px-3 py-2 text-sm">FNPH did not decide this request before its time. Request another time from the referral.</p>}
      {a.status === 'NO_SHOW' && a.noShowReason && <p className="mt-2 rounded-[12px] bg-canvas px-3 py-2 text-sm">{a.noShowReason.replace(/\.$/, '')}.</p>}
      {live && !canJoin && now < opens && <p className="mt-2 text-sm text-muted">The room opens at {formatTime(a.joinWindowOpensAt)} WAT. Have the patient seated somewhere private before then.</p>}
      {can('upload.create') && (a.status === 'AWAITING_APPROVAL' || a.status === 'APPROVED') && (
        <button type="button" className="btn btn-quiet btn-sm mt-2 mr-2" onClick={() => setAttaching(true)}><i aria-hidden className="bi bi-paperclip" /> Attach for the doctor</button>
      )}
      {attaching && (
        <UploadDialog title={`Attach for ${a.patientName}`} referenceId={a.publicId} categories={['REFERRAL_ATTACHMENT', 'LABORATORY_RESULT', 'VITALS_EVIDENCE']}
          onClose={() => setAttaching(false)} onDone={() => { setAttaching(false); toast('Attached. The FNPH doctor can see it.') }} />
      )}
      {can('vitals.submit') && (a.status === 'AWAITING_APPROVAL' || a.status === 'APPROVED' || a.status === 'IN_PROGRESS') && (
        <button type="button" className="btn btn-quiet btn-sm mt-2 mr-2" onClick={() => setRecording(true)}><i aria-hidden className="bi bi-heart-pulse" /> Record vitals</button>
      )}
      {recording && <VitalsDialog appointmentPublicId={a.publicId} patientName={a.patientName} onClose={() => setRecording(false)} />}
      {cancellable && can('appointment.cancel') && (
        <button type="button" className="btn btn-quiet btn-sm mt-2" onClick={() => setCancelling(true)}><i aria-hidden className="bi bi-x-circle" /> Cancel</button>
      )}
      {cancelling && (
        <ReasonDialog
          title={`Cancel ${a.reference}`}
          description="FNPH is told and the time is freed. The referral reopens so you can request another time."
          label="Why is it being cancelled?"
          placeholder="The patient cannot attend on this day."
          confirmLabel="Cancel consultation"
          min={5}
          onClose={() => setCancelling(false)}
          onConfirm={async (reason) => {
            await centreApi.cancelAppointment(a.publicId, reason)
            toast('Cancelled. FNPH has been told.')
            setCancelling(false)
            await refresh()
          }}
        />
      )}
      {canJoin && (
        <Link to={`/centre/consultations/${encodeURIComponent(a.publicId)}`} className="btn btn-primary btn-sm mt-3 no-underline">
          <i aria-hidden className="bi bi-camera-video" /> Join with the patient
        </Link>
      )}
    </li>
  )
}

export function Consultations() {
  const now = useNow(15_000)
  const list = useQuery({ queryKey: ['centre-appointments'], queryFn: centreApi.appointments, refetchInterval: 60_000 })
  return (
    <>
      <PageHeader kicker="Centre" title="Consultations" description="Requests sent to FNPH and confirmed consultations, from the last week onward. The FNPH doctor runs the session; centre staff attend with the patient." />
      <Panel bodyClassName="">
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {list.data?.length === 0 && <EmptyState icon="bi-camera-video" title="Nothing scheduled">Consultations appear here once a referral’s time is requested.</EmptyState>}
        <ul className="divide-y divide-line">{list.data?.map((a) => <Row key={a.publicId} a={a} now={now} />)}</ul>
      </Panel>
    </>
  )
}
