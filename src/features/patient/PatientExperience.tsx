import { Suspense, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/AuthProvider'
import { NotificationMenu } from '@/components/layout/NotificationMenu'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { patientRecordsApi } from '@/lib/api/endpoints/records'
import { initials } from '@/lib/format'
import './patient-experience.css'

const steps = [
  ['Verify your record', 'EHR and identity', '/enrol'],
  ['Create your login', 'Profile and sign-in', '/patients'],
  ['Safety & consent', 'First-time agreement', '/portal/consent'],
  ['Request a consultation', 'Triage, vitals and payment', '/portal/booking'],
  ['Choose a time', 'Published calendar', '/portal/appointments'],
  ['Join your clinician', 'Approval and video', '/portal/appointments'],
  ['Continue your care', 'Released documents and follow-up', '/portal/documents'],
]

export function PatientExperience({ children }: { children: ReactNode }) {
  const { principal, signOut } = useAuth()
  const { emergencyNumber } = usePublicSettings()
  const helpdeskPhone = emergencyNumber
  const location = useLocation()
  const patient = useQuery({ queryKey: ['my-record'], queryFn: patientRecordsApi.me, enabled: Boolean(principal) })
  if (principal) {
    const name = patient.data ? `${patient.data.firstName} ${patient.data.lastName}`.trim() : principal.displayName
    const ehr = patient.data?.ehrNumber
    const maskedEhr = ehr ? `EHR •••• ${ehr.slice(-4)}` : 'Existing FNPH patient'
    const nav = [
      ['Dashboard', '/portal', 'bi-grid-1x2-fill', true],
      ['Book consultation', '/portal/booking', 'bi-calendar2-check-fill', false],
      ['Appointments', '/portal/appointments', 'bi-calendar-event', false],
      ['Prescriptions', '/portal/documents', 'bi-capsule', false],
      ['History', '/portal/history', 'bi-arrow-counterclockwise', false],
    ] as const
    const pageTitle = location.pathname === '/portal/booking' ? 'Book a consultation' : location.pathname === '/portal' ? 'Dashboard' : location.pathname.includes('onboarding') || location.pathname.includes('consent') ? 'Complete first-time setup' : location.pathname.includes('documents') ? 'Prescriptions' : location.pathname.includes('profile') ? 'My patient profile' : 'Appointments'
    return <div className="patient-experience patient-authenticated" data-portal="patient">
      <a className="skip-link" href="#patient-main">Skip to content</a>
      <div className="prototype-ribbon"><b>FNPH patient portal</b><span>Secure access for existing FNPH Kaduna patients.</span></div>
      <div className="emergency-ribbon patient-emergency"><span><strong>Not for emergencies.</strong> If there is immediate danger, severe agitation or acute psychosis, seek urgent in-person care.</span><div><a href={`tel:${emergencyNumber}`}>National emergency <b>{emergencyNumber}</b></a><a href={`tel:${helpdeskPhone}`}>FNPH clinical support <b>{helpdeskPhone}</b></a></div></div>
      <div className="patient-app-shell">
        <aside className="patient-app-sidebar">
          <Link className="patient-side-brand" to="/portal"><img src="/fnph-logo.png" alt="FNPH Kaduna" /><span><b>FNPH Kaduna</b><small>Telepsychiatry</small></span></Link>
          <nav aria-label="Patient portal navigation"><ul>{nav.map(([label,to,icon,end], index) => <li key={`${label}-${index}`}><NavLink to={to} end={end} className={({isActive}) => isActive ? 'active' : ''}><i className={`bi ${icon}`} aria-hidden /><span>{label}</span></NavLink></li>)}</ul></nav>
          <div className="patient-side-bottom"><div className="patient-help"><b>Need help?</b><span>Chat with the FNPH helpdesk or call the support number.</span><Link to="/help">Open helpdesk</Link></div><button type="button" onClick={() => signOut()}><i className="bi bi-box-arrow-left" aria-hidden /> Sign out</button></div>
        </aside>
        <div className="patient-app-content">
          <header className="patient-context-header"><div><span>EXISTING FNPH KADUNA PATIENT</span><b>{pageTitle}</b></div><div className="patient-context-user"><NotificationMenu /><span className="patient-context-avatar">{initials(name)}</span><span><b>{name}</b><small>{maskedEhr}</small></span></div></header>
          <main id="patient-main" className="patient-app-main"><Suspense fallback={<p>Loading your care information…</p>}>{children}</Suspense></main>
        </div>
      </div>
    </div>
  }
  return <div className="patient-experience" data-portal="patient">
    <a className="skip-link" href="#patient-main">Skip to content</a>
    <div className="emergency-ribbon"><strong>Safety first · non-emergency service</strong><span>For immediate danger, seek urgent in-person care.</span><div><a href={`tel:${emergencyNumber}`}>Emergency {emergencyNumber}</a><a href={`tel:${helpdeskPhone}`}>FNPH 24/7 support</a></div></div>
    <header className="site-header"><Link className="brand" to="/"><img src="/fnph-logo.png" alt="Federal Neuropsychiatric Hospital Kaduna logo" /><span><b>FNPH Kaduna</b><small>Telepsychiatry · Existing patient</small></span></Link>
      <div className="header-right"><span className="secure-label">Non-emergency follow-up</span><label className="language-picker"><span aria-hidden>文</span><select aria-label="Language"><option>English</option><option>Hausa</option><option>Igbo</option><option>Yorùbá</option><option>العربية</option><option>Français</option></select></label><Link className="header-help" to="/help">Help &amp; support</Link><Link className="header-signout" to="/patients">Patient sign in</Link></div>
    </header>
    <div className="journey-shell"><aside className="journey-sidebar"><div className="journey-sidebar-head"><span className="eyebrow">One connected journey</span><h2>From hospital card to continuing care</h2><p>Only verified existing FNPH Kaduna patients who have already been assessed in person can use this non-emergency follow-up route.</p></div><ol>{steps.map(([title, subtitle, route], i) => <li key={title} className={location.pathname === route ? 'active' : ''} aria-current={location.pathname === route ? 'step' : undefined}><span>{String(i + 1).padStart(2, '0')}</span><b>{i < 2 ? <Link to={route}>{title}</Link> : title}</b><small>{subtitle}</small></li>)}</ol><div className="rail-support"><b>Your health is our concern</b><p>Private, thoughtful care—at a time and place where you can speak comfortably.</p></div></aside>
      <main id="patient-main" className="journey-main"><Suspense fallback={<p>Loading your care information…</p>}>{children}</Suspense></main></div>
  </div>
}

