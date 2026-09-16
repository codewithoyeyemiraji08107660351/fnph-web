import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { bookingApi, documentsApi, paymentApi } from '@/lib/api/endpoints/patient'
import { patientRecordsApi, triageHistoryApi } from '@/lib/api/endpoints/records'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, formatLongDate, formatNaira, formatPhone, parseServerTime } from '@/lib/format'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { PageHeader, Panel } from '@/components/ui/Page'
import { AppointmentBadge } from '@/components/ui/AppointmentBadge'
import { Spinner } from '@/components/ui/Spinner'
import { useNow } from '@/lib/hooks/useNow'

const UPCOMING = new Set(['SLOT_HELD', 'AWAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS'])

export function PortalHome() {
  const { principal } = useAuth()
  const { emergencyNumber, consultationFee, sessionMinutes } = usePublicSettings()
  const appointments = useQuery({ queryKey: ['my-appointments'], queryFn: bookingApi.mine })
  const documents = useQuery({ queryKey: ['my-documents'], queryFn: documentsApi.mine })
  const credit = useQuery({ queryKey: ['my-credit'], queryFn: paymentApi.credit })
  const record = useQuery({ queryKey: ['my-record'], queryFn: patientRecordsApi.me })
  const safety = useQuery({ queryKey: ['my-triage'], queryFn: triageHistoryApi.mine })
  const lastCheck = safety.data?.[0]

  const now = useNow(60_000)
  const next = (appointments.data ?? [])
    .filter((a) => UPCOMING.has(a.status) && (parseServerTime(a.scheduledEndAt)?.getTime() ?? 0) > now)
    .sort((a, b) => (parseServerTime(a.appointmentDate)?.getTime() ?? 0) - (parseServerTime(b.appointmentDate)?.getTime() ?? 0))[0]
  const ready = (documents.data ?? []).filter((d) => d.status === 'ACTIVE').length

  return (
    <>
      <PageHeader kicker={formatLongDate()} title={`Welcome, ${principal?.displayName.split(' ')[0] ?? ''}`} description="Your follow-up care with FNPH Kaduna." />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Next appointment">
          {appointments.isLoading ? (
            <Spinner label="Checking" />
          ) : next ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-display text-2xl font-extrabold">{formatDateTime(next.appointmentDate)} WAT</p>
                <AppointmentBadge status={next.status} />
              </div>
              <p className="mt-1 text-sm text-muted">Reference {next.reference}</p>
              <Link to={next.status === 'SLOT_HELD' ? '/portal/booking' : '/portal/appointments'} className="btn btn-primary mt-5 no-underline">
                {next.status === 'SLOT_HELD' ? 'Finish booking' : 'View details'}
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted">
                No upcoming appointment. A consultation is {sessionMinutes} minutes by video and costs {formatNaira(consultationFee)}.
              </p>
              <Link to="/portal/booking" className="btn btn-primary mt-5 no-underline">
                Book a consultation
              </Link>
            </div>
          )}
        </Panel>
        <div className="space-y-5">
          <Panel title="Documents">
            <p className="text-sm text-muted">{documents.isLoading ? 'Checking' : ready ? `${ready} ready for you.` : 'Prescriptions and requests appear here after the hospital releases them.'}</p>
            <Link to="/portal/documents" className="btn btn-secondary btn-sm mt-3 no-underline">Open documents</Link>
          </Panel>
          {record.data && (
            <Panel title="Your hospital record">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-muted">Hospital number</dt><dd className="font-bold">{record.data.ehrNumber}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted">Phone on file</dt><dd>{record.data.phoneNumber ? formatPhone(record.data.phoneNumber) : 'None'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted">Email on file</dt><dd className="truncate">{record.data.email ?? 'None'}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-muted">Wrong details? Tell the hospital through Get help. They are changed on the hospital record, not here.</p>
            </Panel>
          )}
          {lastCheck && (
            <Panel title="Last safety check">
              <p className="text-sm">
                {formatDateTime(lastCheck.submittedAt)}:{' '}
                {lastCheck.outcome === 'PROCEED' ? <strong className="text-forest">safe to book</strong> : <strong className="text-alarm-700">not suitable for video at that time</strong>}
              </p>
              <p className="mt-1 text-xs text-muted">You answer the questions again each time you book.</p>
            </Panel>
          )}
          {credit.data && Number(credit.data.balance) > 0 && (
            <Panel title="Credit">
              <p className="font-display text-2xl font-extrabold">{formatNaira(credit.data.balance)}</p>
              <p className="text-xs text-muted">Used automatically on your next booking.</p>
            </Panel>
          )}
          <a href={`tel:${emergencyNumber}`} className="block rounded-[20px] bg-alarm-700 p-5 text-white no-underline">
            <span className="text-sm text-white/80">Not for emergencies. If you are in crisis, call</span>
            <span className="mt-1 block font-display text-2xl font-extrabold">{formatPhone(emergencyNumber)}</span>
          </a>
        </div>
      </div>
    </>
  )
}
