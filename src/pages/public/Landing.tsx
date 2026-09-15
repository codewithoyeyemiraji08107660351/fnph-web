import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { formatPhone } from '@/lib/format'

const ENTRANCES = [
  {
    to: '/patients',
    portal: 'patient',
    audience: 'Existing FNPH Kaduna patients',
    title: 'Patient telepsychiatry',
    body: 'Follow-up care for patients already assessed in person. Enrol with your EHR number, complete triage and vitals, pay, book and join your consultation.',
    cta: 'Go to patient services',
    icon: 'bi-person-heart',
  },
  {
    to: '/staff',
    portal: 'core',
    audience: 'Authorised hospital staff',
    title: 'FNPH Core Engine',
    body: 'Coordination, consultation, pharmacy, laboratory, nursing, records and finance. Each account opens its own workspace.',
    cta: 'Staff sign in',
    icon: 'bi-hospital',
  },
  {
    to: '/centres',
    portal: 'centre',
    audience: 'Kaduna State Government',
    title: 'Centres of Excellence',
    body: 'A fully online specialist referral and consultation pathway for the 23 LGA centres, each kept separate from every other.',
    cta: 'Centre sign in',
    icon: 'bi-buildings',
  },
] as const

const JOURNEY = ['Verify your EHR number', 'Safety triage and consent', 'Recent vital signs', 'Pay and choose a slot', 'Hub approval and room', 'Video consultation']

export function Landing() {
  useDocumentTitle('')
  const { emergencyNumber, sessionMinutes, helpdeskEmail } = usePublicSettings()
  return (
    <>
      <section className="bg-[linear-gradient(160deg,#f7faf8_0%,#e9f2ee_100%)]">
        <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-5 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20 lg:py-20">
          <div>
            <span className="kicker">Specialist mental healthcare online</span>
            <h1 className="text-[clamp(2.4rem,5.6vw,4.6rem)] leading-[1.02] font-extrabold tracking-[-0.05em]">
              Care that connects patients, clinical teams and Kaduna State Centres.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Secure, scheduled and coordinated telepsychiatry from Federal Neuropsychiatric Hospital Kaduna.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/patients" className="btn btn-primary no-underline">
                Existing patient services
              </Link>
              <Link to="/staff" className="btn btn-secondary no-underline">
                Staff and administrator sign in
              </Link>
            </div>
            <p className="mt-6 flex items-start gap-2.5 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blush font-bold text-alarm">!</span>
              <span>
                <strong className="text-alarm">Not for emergencies.</strong>{' '}
                <span className="text-muted">Seek in-person care now for severe agitation, acute psychosis or immediate risk.</span>
              </span>
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(120%_90%_at_85%_10%,#0e6a52_0%,#063a2d_55%,#052a21_100%)] p-7 text-white shadow-[var(--shadow-lift)] sm:p-9">
            <div aria-hidden className="absolute -right-24 -bottom-24 size-72 rounded-full border-[36px] border-white/5" />
            <p className="text-sm font-semibold text-white/70">How a follow-up works</p>
            <ol className="relative mt-5 space-y-3.5">
              {JOURNEY.map((label, i) => (
                <li key={label} className="flex items-center gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/25 font-display text-sm font-bold">{i + 1}</span>
                  <span className="font-semibold">{label}</span>
                </li>
              ))}
            </ol>
            <p className="relative mt-7 border-t border-white/15 pt-5 text-sm text-white/75">
              After the consultation, prescriptions and investigation requests are released to you once the clinical team has reviewed them.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-16 lg:py-20">
        <div className="mb-8 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <span className="kicker">Choose the correct route</span>
          <h2 className="max-w-3xl text-[clamp(1.8rem,3.4vw,2.8rem)] font-extrabold tracking-[-0.04em] lg:text-right">One system with three protected entrances</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {ENTRANCES.map((e) => (
            <Link
              key={e.to}
              to={e.to}
              data-portal={e.portal}
              className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-[22px] border border-line bg-white p-6 text-ink no-underline shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-lift)]"
            >
              <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-accent" />
              <span className="grid size-12 place-items-center self-end rounded-2xl bg-accent-soft text-xl text-accent">
                <i aria-hidden className={`bi ${e.icon}`} />
              </span>
              <span className="mt-6 text-xs text-muted">{e.audience}</span>
              <span className="mt-1 font-display text-xl font-extrabold">{e.title}</span>
              <span className="mt-2 text-sm leading-relaxed text-muted">{e.body}</span>
              <span className="mt-auto pt-6 text-sm font-bold text-accent group-hover:underline">{e.cta}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-[1320px] items-center gap-8 px-5 py-14 md:grid-cols-[auto_1fr_1fr] md:gap-12">
          <div>
            <p className="font-display text-7xl leading-none font-extrabold tracking-[-0.06em] text-forest">{sessionMinutes}</p>
            <p className="mt-1 text-xs font-extrabold tracking-[0.13em] text-forest uppercase">minutes</p>
          </div>
          <div>
            <span className="kicker">A clear consultation model</span>
            <h2 className="text-[clamp(1.7rem,3vw,2.5rem)] font-extrabold tracking-[-0.04em]">Video first. Fixed times. Clinically governed.</h2>
          </div>
          <p className="text-muted">
            Approved appointments use a private, time-limited video room. Audio is used only when the clinician approves it. The start and end times do
            not move, so arriving late shortens the session. Recording stays off unless FNPH approves it with consent.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-14">
        <div className="flex flex-col justify-between gap-6 rounded-[24px] bg-forest px-7 py-8 text-white md:flex-row md:items-center md:px-10">
          <div>
            <p className="text-xs font-extrabold tracking-[0.13em] text-white/70 uppercase">Helpdesk and clinical support</p>
            <h2 className="mt-2 text-[clamp(1.6rem,3vw,2.4rem)] font-extrabold tracking-[-0.04em] text-white">Help is visible from every portal.</h2>
            <p className="mt-2 text-sm text-white/75">
              Technical questions: <a className="font-bold text-white" href={`mailto:${helpdeskEmail}`}>{helpdeskEmail}</a>
            </p>
          </div>
          <div className="md:text-right">
            <p className="text-sm text-white/75">Clinical emergency contact</p>
            <a href={`tel:${emergencyNumber}`} className="font-display text-3xl font-extrabold text-white no-underline">
              {formatPhone(emergencyNumber)}
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
