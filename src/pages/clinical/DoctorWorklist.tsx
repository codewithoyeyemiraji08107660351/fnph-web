import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { workQueueApi } from '@/lib/api/endpoints/clinical'
import type { CentreDoctorRow, DoctorQueueRow } from '@/lib/api/types'
import { formatDateTime, formatTime, parseServerTime, watDate } from '@/lib/format'
import { useNow } from '@/lib/hooks/useNow'
import { useAuth } from '@/lib/auth/AuthProvider'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { AppointmentBadge, WorkStateBadge } from '@/components/ui/AppointmentBadge'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { VitalsList } from './VitalsList'

// room_open_lead_minutes default. Only shapes the button label; the server decides.
const LEAD_MINUTES_FALLBACK = 15

function Row({ row, now }: { row: DoctorQueueRow; now: number }) {
  const { can } = useAuth()
  const [open, setOpen] = useState(false)
  const start = parseServerTime(row.appointmentDate)?.getTime() ?? 0
  const end = parseServerTime(row.scheduledEndAt)?.getTime() ?? 0
  const live = row.status === 'APPROVED' || row.status === 'IN_PROGRESS'
  const roomOpen = live && now >= start - LEAD_MINUTES_FALLBACK * 60_000 && now <= end
  const finished = !live || now > end

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-extrabold">
            {formatTime(row.appointmentDate)} <span className="text-sm font-normal text-muted">to {formatTime(row.scheduledEndAt)}</span>
          </p>
          <p className="font-bold">{row.patientName} <span className="font-normal text-muted">EHR {row.ehrNumber}</span></p>
          <p className="text-sm text-muted">{row.room ?? 'No room'}. {row.reference}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <AppointmentBadge status={row.status} />
            <span className="text-muted">Nursing</span> <WorkStateBadge state={row.nursingState} />
            <span className="text-muted">Records</span> <WorkStateBadge state={row.himState} />
            {row.vitalsRecorded ? <Badge tone="green">Vitals in</Badge> : <Badge tone="gold">No vitals</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {live && !finished && can('consultation.join_as_doctor') && (
            <Link to={`/clinical/appointments/${encodeURIComponent(row.appointmentPublicId)}`} className={`btn btn-sm no-underline ${roomOpen ? 'btn-primary' : 'btn-secondary'}`}>
              <i aria-hidden className="bi bi-camera-video" /> {row.status === 'IN_PROGRESS' ? 'Rejoin' : roomOpen ? 'Open the room' : 'Room opens soon'}
            </Link>
          )}
          {row.consultationPublicId && (
            <Link to={`/clinical/consultations/${encodeURIComponent(row.consultationPublicId)}`} className="btn btn-secondary btn-sm no-underline">
              {finished ? 'Finish the record' : 'Record'}
            </Link>
          )}
        </div>
      </div>
      <button type="button" className="btn btn-quiet btn-sm mt-2 -ml-3" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <i aria-hidden className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'}`} /> Pre-review: vitals
      </button>
      {open && <div className="mt-2"><VitalsList appointmentPublicId={row.appointmentPublicId} /></div>}
    </li>
  )
}

function CentreRow({ row, now }: { row: CentreDoctorRow; now: number }) {
  const { can } = useAuth()
  const start = parseServerTime(row.appointmentDate)?.getTime() ?? 0
  const end = parseServerTime(row.scheduledEndAt)?.getTime() ?? 0
  const live = row.status === 'APPROVED' || row.status === 'IN_PROGRESS'
  const finished = !live || now > end
  const roomOpen = live && now >= start - LEAD_MINUTES_FALLBACK * 60_000 && now <= end
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <p className="font-display text-lg font-extrabold">
          {formatDateTime(row.appointmentDate)} <span className="text-sm font-normal text-muted">to {formatTime(row.scheduledEndAt)}</span>
        </p>
        <p className="font-bold">
          {row.patientName} <span className="font-normal text-muted">at {row.centreName}</span>
        </p>
        {row.referralReason && <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted">Referral: {row.referralReason}</p>}
        <div className="mt-2"><AppointmentBadge status={row.status} /></div>
      </div>
      <div className="flex flex-wrap gap-2">
        {live && !finished && can('consultation.join_as_doctor') && (
          <Link to={`/clinical/centre/${encodeURIComponent(row.appointmentPublicId)}`} className={`btn btn-sm no-underline ${roomOpen ? 'btn-primary' : 'btn-secondary'}`}>
            <i aria-hidden className="bi bi-camera-video" /> {row.status === 'IN_PROGRESS' ? 'Rejoin' : roomOpen ? 'Open the room' : 'Room opens soon'}
          </Link>
        )}
        {row.consultationPublicId && (
          <Link to={`/clinical/centre-consultations/${encodeURIComponent(row.consultationPublicId)}`} className="btn btn-secondary btn-sm no-underline">
            {finished ? 'Finish the record' : 'Record'}
          </Link>
        )}
      </div>
    </li>
  )
}

export function DoctorWorklist() {
  const now = useNow(30_000)
  const list = useQuery({ queryKey: ['doctor-queue'], queryFn: workQueueApi.doctorQueue, refetchInterval: 60_000 })
  const centre = useQuery({ queryKey: ['doctor-centre-queue'], queryFn: workQueueApi.centreQueue, refetchInterval: 60_000 })
  const today = watDate(new Date(now).toISOString())
  const rows = list.data ?? []
  const upcoming = rows.filter((r) => (r.status === 'APPROVED' || r.status === 'IN_PROGRESS') && (parseServerTime(r.scheduledEndAt)?.getTime() ?? 0) >= now)
  const todays = upcoming.filter((r) => watDate(r.appointmentDate) === today)
  const later = upcoming.filter((r) => watDate(r.appointmentDate) !== today)
  const recent = rows.filter((r) => !upcoming.includes(r)).reverse()

  const group = (title: string, items: DoctorQueueRow[], empty?: string) => (
    <Panel title={`${title} (${items.length})`} className="mb-5" bodyClassName="">
      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">{items.map((r) => <Row key={r.appointmentPublicId} row={r} now={now} />)}</ul>
      )}
    </Panel>
  )

  return (
    <>
      <PageHeader kicker="Clinical" title="My consultations" description="Consultations assigned to you. Review vitals before opening the room. Finished sessions stay here for two weeks so you can complete the record." />
      {list.isLoading && <Spinner label="Loading your consultations" />}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.isSuccess && rows.length === 0 && !centre.data?.length && (
        <div className="card"><EmptyState icon="bi-camera-video" title="Nothing assigned">Approved consultations appear here when the Hub Coordinator assigns you.</EmptyState></div>
      )}
      {list.isSuccess && rows.length > 0 && (
        <>
          {group('Today', todays, 'Nothing else today.')}
          {later.length > 0 && group('Coming up', later)}
          {recent.length > 0 && group('Recently finished', recent)}
        </>
      )}
      {centre.data && centre.data.length > 0 && (
        <Panel title={`Centre of Excellence consultations (${centre.data.length})`} className="mb-5" bodyClassName="">
          <ul className="divide-y divide-line">
            {centre.data.map((r) => <CentreRow key={r.appointmentPublicId} row={r} now={now} />)}
          </ul>
        </Panel>
      )}
      {list.isSuccess && rows.length > 0 && <p className="text-xs text-muted">Last updated {formatDateTime(new Date(list.dataUpdatedAt).toISOString())}.</p>}
    </>
  )
}
