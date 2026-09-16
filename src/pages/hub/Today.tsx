import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { lifecycleApi, type DayRow } from '@/lib/api/endpoints/records'
import { useAuth } from '@/lib/auth/AuthProvider'
import { DISPLAY_TIME_ZONE, formatCalendarDate, formatTime, parseServerTime } from '@/lib/format'
import { useNow } from '@/lib/hooks/useNow'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { AppointmentBadge } from '@/components/ui/AppointmentBadge'
import { TextField } from '@/components/ui/Field'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import type { AppointmentStatus } from '@/lib/api/types'

const watDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE }).format(new Date())

export function Today() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const now = useNow(30_000)
  const [date, setDate] = useState(watDay())
  const [marking, setMarking] = useState<DayRow | null>(null)
  const day = useQuery({ queryKey: ['hub-day', date], queryFn: () => lifecycleApi.day(date), refetchInterval: 60_000 })
  return (
    <>
      <PageHeader kicker="Hub coordination" title="Appointments by day" description="Everything booked for a day, in hospital time. Record a patient who did not attend once the appointment has started."
        actions={<Link to="/hub/cancellations" className="btn btn-secondary no-underline">Cancellation requests</Link>} />
      <div className="mb-4 max-w-xs"><TextField label="Day" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <Panel title={formatCalendarDate(date)} bodyClassName="">
        {day.isLoading && <div className="p-5"><Spinner /></div>}
        {day.isError && <ErrorState error={day.error} onRetry={() => day.refetch()} />}
        {day.data?.length === 0 && <EmptyState icon="bi-calendar" title="Nothing booked on this day" />}
        <div className="overflow-x-auto">
          {!!day.data?.length && (
            <table className="table-base min-w-[720px]">
              <thead><tr><th>Time</th><th>Patient</th><th>Doctor and room</th><th>State</th><th /></tr></thead>
              <tbody>
                {day.data.map((a) => {
                  const started = (parseServerTime(a.appointmentDate)?.getTime() ?? Infinity) <= now
                  const canMark = can('appointment.mark_no_show') && started && (a.status === 'APPROVED' || a.status === 'IN_PROGRESS')
                  return (
                    <tr key={a.publicId}>
                      <td className="whitespace-nowrap font-bold">{formatTime(a.appointmentDate)}<span className="block text-xs font-normal text-muted">{a.reference}</span></td>
                      <td>{a.patientName}<span className="block text-xs text-muted">EHR {a.ehrNumber}</span></td>
                      <td className="text-sm">{a.doctorName ?? 'Not assigned'}<span className="block text-xs text-muted">{a.room ?? ''}</span></td>
                      <td><AppointmentBadge status={a.status as AppointmentStatus} /></td>
                      <td className="text-right">
                        {a.status === 'AWAITING_APPROVAL' && <Link to={`/hub/approvals/${encodeURIComponent(a.publicId)}`} className="btn btn-quiet btn-sm no-underline">Approve</Link>}
                        {canMark && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMarking(a)}>Did not attend</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
      {marking && (
        <ReasonDialog title={`${marking.patientName} did not attend?`} label="What happened" min={5} confirmLabel="Record as not attended" danger
          description="The patient is told the appointment was recorded as not attended and asked to contact the hospital."
          placeholder="Not in the room 15 minutes after the start. Called twice, no answer."
          onClose={() => setMarking(null)}
          onConfirm={async (notes) => { await lifecycleApi.noShow(marking.publicId, notes); toast('Recorded as not attended.'); setMarking(null); await qc.invalidateQueries({ queryKey: ['hub-day'] }) }} />
      )}
    </>
  )
}
