import { Suspense, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { NotificationMenu } from '@/components/layout/NotificationMenu'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { initials } from '@/lib/format'
import './patient-experience.css'

const steps = [
  ['Enrolment', 'Verify your FNPH record', '/enrol'],
  ['Your account', 'Secure patient access', '/patients'],
  ['Safety & consent', 'First-time agreement', '/portal/consent'],
  ['Request care', 'Safety, information & payment', '/portal/booking'],
  ['Booking', 'Published dates & times', '/portal/appointments'],
  ['Consultation', 'Approved private session', '/portal/appointments'],
  ['Aftercare', 'Released care documents', '/portal/documents'],
]

export function PatientExperience({ children }: { children: ReactNode }) {
  const { principal, signOut } = useAuth()
  const { emergencyNumber } = usePublicSettings()
  const helpdeskPhone = emergencyNumber
  const location = useLocation()
  return <div className="patient-experience" data-portal="patient">
    <a className="skip-link" href="#patient-main">Skip to content</a>
    <div className="emergency-ribbon"><strong>Safety first · non-emergency service</strong><span>For immediate danger, seek urgent in-person care.</span><div><a href={`tel:${emergencyNumber}`}>Emergency {emergencyNumber}</a><a href={`tel:${helpdeskPhone}`}>FNPH 24/7 support</a></div></div>
    <header className="site-header"><Link className="brand" to="/"><img src="/fnph-logo.png" alt="FNPH Kaduna" /><span><b>FNPH Kaduna</b><small>Telepsychiatry · patient portal</small></span></Link>
      <div className="header-right"><Link className="header-help" to="/help">24/7 Help & Support</Link>{principal ? <><NotificationMenu /><Link className="profile-trigger" to="/portal/profile"><span className="profile-avatar">{initials(principal.displayName)}</span>My profile</Link><button className="header-signout" onClick={() => signOut()}>Sign out</button></> : <Link className="header-signout" to="/patients">Patient sign in</Link>}</div>
    </header>
    <div className="journey-shell"><aside className="journey-sidebar"><div className="journey-sidebar-head"><span className="eyebrow">Your care journey</span><h2>One step at a time.</h2><p>A clear path from your hospital record to connected follow-up care.</p></div><ol>{steps.map(([title, subtitle, route], i) => <li key={title} className={location.pathname === route ? 'active' : ''} aria-current={location.pathname === route ? 'step' : undefined}><span>{String(i + 1).padStart(2, '0')}</span><b>{principal || i < 2 ? <Link to={route}>{title}</Link> : title}</b><small>{subtitle}</small></li>)}</ol>{principal && <Link className="button secondary" to="/portal">My dashboard</Link>}<div className="rail-support"><b>Existing FNPH patients only</b><p>Your offline hospital EHR remains the authoritative clinical record.</p></div></aside>
      <main id="patient-main" className="journey-main"><Suspense fallback={<p>Loading your care information…</p>}>{children}</Suspense></main></div>
  </div>
}

