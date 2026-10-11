import { Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  bookingApi,
  carePathApi,
  documentsApi,
  myRecordsApi,
} from '@/lib/api/endpoints/patient'
import { followUpsApi } from '@/lib/api/endpoints/records'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useNow } from '@/lib/hooks/useNow'
import { formatDateTime, parseServerTime } from '@/lib/format'
import { ErrorState } from '@/components/ui/Page'
import {
  careNotices,
  countdownParts,
  followUpTarget,
  greeting,
  hospitalToday,
  latestShown,
  longDate,
  pickFollowUp,
  releaseState,
  shortDate,
  todayLine,
  watParts,
  type CareNotice,
  type ReleaseState,
} from './homeSummary'

const LIVE_STATUSES = ['AWAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS'] as const
const JOINABLE_STATUSES = ['APPROVED', 'IN_PROGRESS'] as const
const JOIN_GRACE_MS = 15 * 60 * 1000
const LIST_LIMIT = 4

const STATE_LABEL: Record<ReleaseState, string> = {
  ready: 'Ready',
  expired: 'Expired',
  checking: 'Being checked',
}

const NOTICE_ICON: Record<CareNotice['tone'], string> = {
  danger: 'bi-exclamation-octagon-fill',
  warning: 'bi-exclamation-triangle-fill',
  info: 'bi-info-circle-fill',
}

/** Days, hours, minutes, seconds. Read out once a minute, not every tick. */
function Countdown({ ms, label }: { ms: number; label: string }) {
  const p = countdownParts(ms)
  const units: Array<[number, string]> = [
    [p.days, p.days === 1 ? 'day' : 'days'],
    [p.hours, p.hours === 1 ? 'hour' : 'hours'],
    [p.minutes, p.minutes === 1 ? 'minute' : 'minutes'],
    [p.seconds, p.seconds === 1 ? 'second' : 'seconds'],
  ]
  return (
    <div className="pd2-count" role="timer" aria-label={`${label}: ${p.days} days, ${p.hours} hours, ${p.minutes} minutes`}>
      {units.map(([n, unit], i) => (
        <span key={unit} className="pd2-count-unit" aria-hidden>
          <b>{i === 0 ? n : String(n).padStart(2, '0')}</b>
          <small>{unit}</small>
        </span>
      ))}
    </div>
  )
}

export function PortalHome() {
  const { principal, can } = useAuth()

  const appointments = useQuery({
    queryKey: ['my-appointments'],
    queryFn: bookingApi.mine,
    refetchInterval: 30000,
  })
  const documents = useQuery({
    queryKey: ['my-documents'],
    queryFn: documentsApi.mine,
    enabled: can('document.read_own'),
  })
  const prescriptions = useQuery({
    queryKey: ['my-prescriptions'],
    queryFn: myRecordsApi.prescriptions,
    enabled: can('prescription.read_own'),
  })
  const investigations = useQuery({
    queryKey: ['my-investigations'],
    queryFn: myRecordsApi.investigations,
    enabled: can('investigation.read_own'),
  })
  const followUps = useQuery({
    queryKey: ['my-follow-ups'],
    queryFn: followUpsApi.mine,
    enabled: can('follow_up.read_own'),
  })
  const consent = useQuery({
    queryKey: ['consent-receipt'],
    queryFn: carePathApi.receipt,
  })
  const triage = useQuery({
    queryKey: ['triage-history'],
    queryFn: carePathApi.triageHistory,
  })

  const now = useNow(1000)

  const next = appointments.data
    ?.filter(
      (a) =>
        LIVE_STATUSES.includes(a.status as (typeof LIVE_STATUSES)[number]) &&
        (parseServerTime(a.scheduledEndAt)?.getTime() ?? 0) > now,
    )
    .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate))[0]

  const start = parseServerTime(next?.appointmentDate)?.getTime() ?? 0
  const opening = parseServerTime(next?.joinWindowOpensAt)?.getTime() ?? Infinity
  const live =
    !!next &&
    JOINABLE_STATUSES.includes(next.status as (typeof JOINABLE_STATUSES)[number]) &&
    now >= opening &&
    now < start + JOIN_GRACE_MS

  if (consent.isLoading || triage.isLoading) {
    return <p>Checking your first-time setup…</p>
  }

  if (consent.isError || triage.isError) {
    return (
      <ErrorState
        error={consent.error ?? triage.error}
        onRetry={() => {
          void consent.refetch()
          void triage.refetch()
        }}
      />
    )
  }

  if (!consent.data?.publicId || !triage.data?.length) {
    return <Navigate to="/portal/onboarding" replace />
  }

  const today = hospitalToday(now)
  const due = pickFollowUp(followUps.data, today)
  const dueAt = due ? followUpTarget(due) : null
  const rx = latestShown(prescriptions.data ?? undefined)
  const lab = latestShown(investigations.data ?? undefined)
  const approved =
    !!next && JOINABLE_STATUSES.includes(next.status as (typeof JOINABLE_STATUSES)[number])
  const readyDocuments = documents.data?.filter((d) => d.status === 'ACTIVE').length ?? 0
  const firstName = (principal?.displayName ?? '').split(' ')[0]
  const leaf = next ? watParts(start) : null

  const notices = careNotices({
    today,
    due,
    hasUpcomingAppointment: !!next,
    awaitingConfirmation:
      next && next.status === 'AWAITING_APPROVAL' ? `${formatDateTime(next.appointmentDate)} WAT` : null,
    prescription: rx,
    investigation: lab,
  })

  const summary = [
    !next
      ? 'You have no appointment booked.'
      : live
        ? 'Your consultation room is open.'
        : approved
          ? 'Your next appointment is confirmed.'
          : 'Your appointment request is waiting for confirmation.',
    due?.date && due.days != null
      ? due.days < 0
        ? 'Your follow-up review is overdue.'
        : due.days === 0
          ? 'Your follow-up review is due today.'
          : `Your follow-up review is in ${due.days} day${due.days === 1 ? '' : 's'}.`
      : null,
  ].filter(Boolean).join(' ')

  return (
    <div className="pd2">
      {/* ---------- Header ---------- */}
      <header className="pd2-head">
        <div>
          <p className="pd2-date">{todayLine(now)}</p>
          <h1>
            {greeting(now)}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="pd2-lede">{summary}</p>
        </div>
        <div className="pd2-head-actions">
          <Link className="pd2-btn pd2-btn-primary" to="/portal/booking">
            <i className="bi bi-calendar-plus" aria-hidden /> Book a consultation
          </Link>
          <Link className="pd2-btn pd2-btn-quiet" to="/help">
            Get help
          </Link>
        </div>
      </header>

      {/* ---------- Needs attention ---------- */}
      {notices.length > 0 && (
        <section className="pd2-notices" aria-labelledby="pd2-notices-title">
          <h2 id="pd2-notices-title" className="pd2-h2">Needs your attention</h2>
          <ul>
            {notices.map((n) => (
              <li key={n.id} className={`pd2-notice is-${n.tone}`} role={n.tone === 'danger' ? 'alert' : undefined}>
                <i className={`bi ${NOTICE_ICON[n.tone]}`} aria-hidden />
                <div>
                  <p className="pd2-notice-title">{n.title}</p>
                  <p className="pd2-notice-body">{n.body}</p>
                </div>
                {n.action && (
                  <Link className="pd2-notice-action" to={n.action.to}>
                    {n.action.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Coming up ---------- */}
      <section className="pd2-band" aria-labelledby="pd2-band-title">
        <h2 id="pd2-band-title" className="pd2-sr">Coming up</h2>

        {/* Appointment */}
        <div className="pd2-slot">
          <p className="pd2-slot-label">Next appointment</p>
          {appointments.isError ? (
            <ErrorState error={appointments.error} onRetry={() => appointments.refetch()} />
          ) : appointments.isLoading ? (
            <p className="pd2-slot-quiet">Loading your appointments…</p>
          ) : !next || !leaf ? (
            <>
              <p className="pd2-slot-title">No appointment booked</p>
              <p className="pd2-slot-quiet">Book a consultation when you need to see your doctor. Times are shown from the hospital’s published calendar.</p>
              <Link className="pd2-btn pd2-btn-light" to="/portal/booking">Book a consultation</Link>
            </>
          ) : (
            <>
              <div className="pd2-when">
                <span className="pd2-leaf" aria-hidden>
                  <small>{leaf.weekday}</small>
                  <b>{leaf.day}</b>
                  <small>{leaf.month}</small>
                </span>
                <div>
                  <p className="pd2-slot-title">{leaf.time} WAT</p>
                  <p className="pd2-slot-quiet">
                    {live ? 'Your doctor is ready' : approved ? 'Confirmed' : 'Waiting for the hospital to confirm'}
                    {next.room ? `, ${next.room}` : ''}
                  </p>
                  <p className="pd2-ref">Reference {next.reference}</p>
                </div>
              </div>
              {live ? (
                <Link className="pd2-join" to={`/portal/consultations/${next.publicId}`}>
                  <span className="pd2-live-dot" aria-hidden /> Join consultation now
                </Link>
              ) : approved && start > now ? (
                <>
                  <Countdown ms={start - now} label="Time until your appointment" />
                  <Link className="pd2-link-light" to="/portal/appointments">View appointment details</Link>
                </>
              ) : (
                <Link className="pd2-link-light" to="/portal/appointments">View appointment details</Link>
              )}
            </>
          )}
        </div>

        {/* Follow-up */}
        <div className="pd2-slot">
          <p className="pd2-slot-label">Follow-up review</p>
          {followUps.isError ? (
            <p className="pd2-slot-quiet">Your follow-up could not be loaded. Reload the page to try again.</p>
          ) : !due ? (
            <>
              <p className="pd2-slot-title">None scheduled</p>
              <p className="pd2-slot-quiet">After a consultation your doctor will say when they want to see you again. The date will appear here.</p>
            </>
          ) : !due.date || dueAt == null ? (
            <>
              <p className="pd2-slot-title">Your doctor wants to see you again</p>
              {due.followUp.recommendation && <p className="pd2-advice">{due.followUp.recommendation}</p>}
            </>
          ) : (
            <>
              <p className="pd2-slot-title">
                {due.estimated ? 'Around ' : ''}
                {longDate(due.date)}
              </p>
              <p className="pd2-slot-quiet">
                {due.scheduled ? 'Booked by the hospital' : due.estimated ? 'Estimated from the review period your doctor gave' : 'Date set by your doctor'}
              </p>
              {dueAt > now ? (
                <Countdown ms={dueAt - now} label="Time until your follow-up review" />
              ) : (
                <p className="pd2-overdue">
                  {due.days != null && due.days < 0
                    ? `Overdue by ${Math.abs(due.days)} day${Math.abs(due.days) === 1 ? '' : 's'}`
                    : 'Due today'}
                </p>
              )}
              {due.followUp.recommendation && <p className="pd2-advice">{due.followUp.recommendation}</p>}
            </>
          )}
        </div>
      </section>

      {/* ---------- Current treatment ---------- */}
      <section className="pd2-ledger" aria-labelledby="pd2-ledger-title">
        <div className="pd2-ledger-head">
          <h2 id="pd2-ledger-title" className="pd2-h2">Your current treatment</h2>
          <Link className="pd2-text-link" to="/portal/documents">
            Prescriptions and lab requests
            {readyDocuments > 0 ? ` (${readyDocuments} ready)` : ''}
          </Link>
        </div>

        <div className="pd2-ledger-cols">
          {/* Medicines */}
          <div className="pd2-col">
            <div className="pd2-col-head">
              <h3>Medicines</h3>
              {rx && <span className={`pd2-pill is-${releaseState(rx.status)}`}>{STATE_LABEL[releaseState(rx.status)]}</span>}
            </div>
            {prescriptions.isError ? (
              <p className="pd2-muted">Your prescription could not be loaded. Reload the page to try again.</p>
            ) : prescriptions.isLoading ? (
              <p className="pd2-muted">Loading…</p>
            ) : !rx ? (
              <p className="pd2-muted">No prescription yet. Medicines your doctor prescribes will be listed here.</p>
            ) : releaseState(rx.status) === 'checking' ? (
              <p className="pd2-muted">Your new prescription is with the pharmacy for checking. The medicines will be listed here once it is released.</p>
            ) : (
              <>
                <table className="pd2-table">
                  <thead>
                    <tr>
                      <th scope="col">Medicine</th>
                      <th scope="col">How often</th>
                      <th scope="col">For how long</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rx.items.slice(0, LIST_LIMIT).map((i, n) => (
                      <tr key={n}>
                        <td>
                          <b>{i.medication}</b>
                          {i.strength && i.strength !== 'null' ? <span> {i.strength}</span> : null}
                        </td>
                        <td>{i.frequency && i.frequency !== 'null' ? i.frequency : 'As directed'}</td>
                        <td>{i.duration && i.duration !== 'null' ? i.duration : 'As directed'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="pd2-foot">
                  {rx.items.length > LIST_LIMIT ? `${rx.items.length - LIST_LIMIT} more on the full prescription. ` : ''}
                  {releaseState(rx.status) === 'expired'
                    ? `Expired${rx.expiryDate ? ` on ${shortDate(rx.expiryDate)}` : ''}.`
                    : `Issued ${shortDate(rx.issueDate)}${rx.expiryDate ? `, valid until ${shortDate(rx.expiryDate)}` : ''}.`}
                </p>
              </>
            )}
          </div>

          {/* Lab tests */}
          <div className="pd2-col">
            <div className="pd2-col-head">
              <h3>Lab tests</h3>
              {lab && <span className={`pd2-pill is-${releaseState(lab.status)}`}>{STATE_LABEL[releaseState(lab.status)]}</span>}
            </div>
            {investigations.isError ? (
              <p className="pd2-muted">Your lab request could not be loaded. Reload the page to try again.</p>
            ) : investigations.isLoading ? (
              <p className="pd2-muted">Loading…</p>
            ) : !lab ? (
              <p className="pd2-muted">No lab tests requested. Tests your doctor asks for will be listed here.</p>
            ) : releaseState(lab.status) === 'checking' ? (
              <p className="pd2-muted">Your lab request is with the laboratory for checking. The tests will be listed here once it is released.</p>
            ) : (
              <>
                <ul className="pd2-tests">
                  {lab.panels.slice(0, LIST_LIMIT).map((p, n) => (
                    <li key={n}>{p.panelName}</li>
                  ))}
                </ul>
                <p className="pd2-foot">
                  {lab.panels.length > LIST_LIMIT ? `${lab.panels.length - LIST_LIMIT} more on the full request. ` : ''}
                  {releaseState(lab.status) === 'expired'
                    ? `Expired${lab.expiryDate ? ` on ${shortDate(lab.expiryDate)}` : ''}.`
                    : `Take the request to the laboratory${lab.expiryDate ? ` by ${shortDate(lab.expiryDate)}` : ''}.`}
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Shortcuts ---------- */}
      <nav className="pd2-shortcuts" aria-label="Shortcuts">
        <Link to="/portal/booking"><i className="bi bi-calendar-plus" aria-hidden /> Book consultation</Link>
        <Link to="/portal/appointments"><i className="bi bi-calendar-check" aria-hidden /> My appointments</Link>
        <Link to="/portal/documents"><i className="bi bi-file-earmark-medical" aria-hidden /> My documents</Link>
        <Link to="/portal/profile"><i className="bi bi-person" aria-hidden /> My profile</Link>
        <Link to="/help"><i className="bi bi-question-circle" aria-hidden /> Get help</Link>
      </nav>

      <p className="pd2-receipt">
        First-time agreement recorded: {consent.data.version}, {formatDateTime(consent.data.acceptedAt)} WAT.{' '}
        <Link to="/portal/consent">View receipt</Link>
      </p>
    </div>
  )
}
