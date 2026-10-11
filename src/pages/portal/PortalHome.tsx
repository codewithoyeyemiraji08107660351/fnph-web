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
  greeting,
  hospitalToday,
  latestShown,
  longDate,
  pickFollowUp,
  releaseState,
  shortDate,
  startsIn,
  type ReleaseState,
} from './homeSummary'

const LIVE_STATUSES = ['AWAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS'] as const
const JOINABLE_STATUSES = ['APPROVED', 'IN_PROGRESS'] as const
const JOIN_GRACE_MS = 15 * 60 * 1000
const LIST_LIMIT = 3

const STATE_LABEL: Record<ReleaseState, string> = {
  ready: 'Ready',
  expired: 'Expired',
  checking: 'Being checked',
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
  const rx = latestShown(prescriptions.data ?? undefined)
  const lab = latestShown(investigations.data ?? undefined)
  const approved =
    !!next && JOINABLE_STATUSES.includes(next.status as (typeof JOINABLE_STATUSES)[number])
  const newDocuments = documents.data?.filter((d) => d.status === 'ACTIVE').length ?? 0
  const firstName = (principal?.displayName ?? '').split(' ')[0]

  return (
    <div className="pd">
      <section className="pd-hello">
        <div>
          <h1>
            {greeting(now)}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p>Everything about your care is on this page. Tap a box to see more.</p>
        </div>
        <Link className="button primary large" to="/portal/booking">
          <i className="bi bi-calendar-plus" aria-hidden /> Book a consultation
        </Link>
      </section>

      {/* ---------- 1. Next appointment ---------- */}
      <section
        className={`pd-next ${live ? 'is-live' : approved ? 'is-approved' : next ? 'is-waiting' : 'is-empty'}`}
        aria-labelledby="pd-next-title"
      >
        <span className="pd-icon" aria-hidden>
          <i className={`bi ${live ? 'bi-camera-video-fill' : 'bi-calendar-event'}`} />
        </span>
        <div className="pd-next-body">
          <span className="pd-label" id="pd-next-title">
            Your next appointment
          </span>
          {appointments.isError ? (
            <ErrorState error={appointments.error} onRetry={() => appointments.refetch()} />
          ) : appointments.isLoading ? (
            <strong>Loading…</strong>
          ) : !next ? (
            <>
              <strong>You have no appointment booked</strong>
              <p>When you need to see your doctor, tap “Book a consultation”.</p>
            </>
          ) : live ? (
            <>
              <strong>Your doctor is ready. Join now.</strong>
              <p>
                {formatDateTime(next.appointmentDate)} WAT{next.room ? ` · ${next.room}` : ''}
              </p>
            </>
          ) : (
            <>
              <strong>{formatDateTime(next.appointmentDate)} WAT</strong>
              <p>
                {approved ? (
                  start > now ? (
                    <>
                      Starts <b className="pd-tick">{startsIn(start - now)}</b>
                    </>
                  ) : (
                    'Your appointment time has arrived'
                  )
                ) : (
                  'Booked. Waiting for the hospital to confirm it.'
                )}
                {next.room ? ` · ${next.room}` : ''}
              </p>
              <span className="pd-ref">Reference {next.reference}</span>
            </>
          )}
        </div>
        {next && live ? (
          <Link className="live-button live pd-join" to={`/portal/consultations/${next.publicId}`}>
            <span className="live-signal">
              <i /> LIVE
            </span>
            <span>
              <b>Join consultation</b>
              <small>Tap to enter the video room</small>
            </span>
          </Link>
        ) : next ? (
          <Link className="button secondary" to="/portal/appointments">
            See appointment
          </Link>
        ) : (
          <Link className="button primary" to="/portal/booking">
            Book now
          </Link>
        )}
      </section>

      {/* ---------- 2. At a glance ---------- */}
      <h2 className="pd-section">Your care at a glance</h2>
      <div className="pd-tiles">
        {/* Follow-up */}
        <section className="pd-tile" aria-labelledby="pd-fu-title">
          <header>
            <span className="pd-icon soft" aria-hidden>
              <i className="bi bi-arrow-repeat" />
            </span>
            <span className="pd-label" id="pd-fu-title">
              Next follow-up
            </span>
          </header>
          {followUps.isError ? (
            <p className="pd-muted">Could not load your follow-up. Reload to try again.</p>
          ) : !due ? (
            <>
              <p className="pd-big-text">No follow-up yet</p>
              <p className="pd-muted">Your doctor will tell you when to come back.</p>
            </>
          ) : due.days == null ? (
            <>
              <p className="pd-big-text">Your doctor wants to see you again</p>
              <p className="pd-quote">{due.followUp.recommendation}</p>
            </>
          ) : (
            <>
              <div className="pd-count" aria-live="polite">
                {due.days > 0 ? (
                  <>
                    <b>{due.days}</b>
                    <span>
                      {due.days === 1 ? 'day' : 'days'} to go{due.estimated ? ' (about)' : ''}
                    </span>
                  </>
                ) : due.days === 0 ? (
                  <b className="pd-today">Today</b>
                ) : (
                  <>
                    <b className="pd-overdue">{Math.abs(due.days)}</b>
                    <span>{Math.abs(due.days) === 1 ? 'day' : 'days'} overdue</span>
                  </>
                )}
              </div>
              <p className="pd-muted">
                {due.estimated ? 'Around ' : ''}
                {due.date ? longDate(due.date) : ''}
                {due.scheduled ? ' · booked by the hospital' : ''}
              </p>
              {due.followUp.recommendation && (
                <p className="pd-quote">{due.followUp.recommendation}</p>
              )}
            </>
          )}
          {due && (
          <div className="pd-tile-foot">
            {!due.scheduled && !next ? (
              <Link className="button primary" to="/portal/booking">
                Book my follow-up
              </Link>
            ) : (
              <Link className="button secondary" to="/portal/documents">
                Read doctor’s advice
              </Link>
            )}
          </div>
          )}
        </section>

        {/* Prescription */}
        <section className="pd-tile" aria-labelledby="pd-rx-title">
          <header>
            <span className="pd-icon soft" aria-hidden>
              <i className="bi bi-capsule" />
            </span>
            <span className="pd-label" id="pd-rx-title">
              My medicines
            </span>
            {rx && <span className={`pd-chip ${releaseState(rx.status)}`}>{STATE_LABEL[releaseState(rx.status)]}</span>}
          </header>
          {prescriptions.isError ? (
            <p className="pd-muted">Could not load your prescription. Reload to try again.</p>
          ) : prescriptions.isLoading ? (
            <p className="pd-muted">Loading…</p>
          ) : !rx ? (
            <>
              <p className="pd-big-text">No prescription yet</p>
              <p className="pd-muted">Medicines your doctor prescribes will show here.</p>
            </>
          ) : releaseState(rx.status) === 'checking' ? (
            <>
              <p className="pd-big-text">Your prescription is being checked</p>
              <p className="pd-muted">The pharmacy is checking it. You will see your medicines here once it is ready.</p>
            </>
          ) : (
            <>
              <ul className="pd-list">
                {rx.items.slice(0, LIST_LIMIT).map((i, n) => (
                  <li key={n}>
                    <b>
                      {i.medication}
                      {i.strength ? ` ${i.strength}` : ''}
                    </b>
                    <span>{[i.frequency, i.duration].filter((x) => x && x !== 'null').join(' · ')}</span>
                  </li>
                ))}
              </ul>
              {rx.items.length > LIST_LIMIT && (
                <p className="pd-muted">and {rx.items.length - LIST_LIMIT} more</p>
              )}
              <p className="pd-muted">
                {releaseState(rx.status) === 'expired'
                  ? `Expired${rx.expiryDate ? ` on ${shortDate(rx.expiryDate)}` : ''}. Ask your doctor before refilling.`
                  : `Issued ${shortDate(rx.issueDate)}${rx.expiryDate ? ` · valid until ${shortDate(rx.expiryDate)}` : ''}`}
              </p>
            </>
          )}
          {rx && (
          <div className="pd-tile-foot">
            <Link className="button secondary" to="/portal/documents">
              See prescription
            </Link>
          </div>
          )}
        </section>

        {/* Laboratory */}
        <section className="pd-tile" aria-labelledby="pd-lab-title">
          <header>
            <span className="pd-icon soft" aria-hidden>
              <i className="bi bi-droplet-half" />
            </span>
            <span className="pd-label" id="pd-lab-title">
              My lab tests
            </span>
            {lab && <span className={`pd-chip ${releaseState(lab.status)}`}>{STATE_LABEL[releaseState(lab.status)]}</span>}
          </header>
          {investigations.isError ? (
            <p className="pd-muted">Could not load your lab tests. Reload to try again.</p>
          ) : investigations.isLoading ? (
            <p className="pd-muted">Loading…</p>
          ) : !lab ? (
            <>
              <p className="pd-big-text">No lab tests yet</p>
              <p className="pd-muted">Tests your doctor asks for will show here.</p>
            </>
          ) : releaseState(lab.status) === 'checking' ? (
            <>
              <p className="pd-big-text">Your lab request is being checked</p>
              <p className="pd-muted">The laboratory is checking it. You will see the tests here once it is ready.</p>
            </>
          ) : (
            <>
              <ul className="pd-list">
                {lab.panels.slice(0, LIST_LIMIT).map((p, n) => (
                  <li key={n}>
                    <b>{p.panelName}</b>
                  </li>
                ))}
              </ul>
              {lab.panels.length > LIST_LIMIT && (
                <p className="pd-muted">and {lab.panels.length - LIST_LIMIT} more</p>
              )}
              <p className="pd-muted">
                {releaseState(lab.status) === 'expired'
                  ? `Expired${lab.expiryDate ? ` on ${shortDate(lab.expiryDate)}` : ''}`
                  : `Take the request to the laboratory${lab.expiryDate ? ` by ${shortDate(lab.expiryDate)}` : ''}`}
              </p>
            </>
          )}
          {lab && (
          <div className="pd-tile-foot">
            <Link className="button secondary" to="/portal/documents">
              See lab request
            </Link>
          </div>
          )}
        </section>
      </div>

      {/* ---------- 3. What do you want to do? ---------- */}
      <h2 className="pd-section">What would you like to do?</h2>
      <nav className="pd-actions" aria-label="Quick actions">
        <Link to="/portal/booking" className="pd-action">
          <i className="bi bi-calendar-plus" aria-hidden />
          <span>
            <b>Book a consultation</b>
            <small>See your doctor by video</small>
          </span>
        </Link>
        <Link to="/portal/appointments" className="pd-action">
          <i className="bi bi-calendar-check" aria-hidden />
          <span>
            <b>My appointments</b>
            <small>Times, changes and past visits</small>
          </span>
        </Link>
        <Link to="/portal/documents" className="pd-action">
          <i className="bi bi-file-earmark-medical" aria-hidden />
          <span>
            <b>My documents</b>
            <small>
              {newDocuments > 0
                ? `Prescriptions and lab requests · ${newDocuments} ready`
                : 'Prescriptions and lab requests'}
            </small>
          </span>
        </Link>
        <Link to="/portal/profile" className="pd-action">
          <i className="bi bi-person-circle" aria-hidden />
          <span>
            <b>My profile</b>
            <small>Phone, email and password</small>
          </span>
        </Link>
        <Link to="/help" className="pd-action">
          <i className="bi bi-question-circle" aria-hidden />
          <span>
            <b>Get help</b>
            <small>Talk to the FNPH helpdesk</small>
          </span>
        </Link>
      </nav>

      <div className="consent-receipt">
        <b>First-time agreement recorded</b>
        <span>
          {consent.data.version} · {formatDateTime(consent.data.acceptedAt)} WAT
        </span>
        <Link to="/portal/consent">View receipt</Link>
      </div>
    </div>
  )
}
