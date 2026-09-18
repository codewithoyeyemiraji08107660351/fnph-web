import { Suspense, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { NotificationMenu } from '@/components/layout/NotificationMenu'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
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
  return <div className="patient-experience" data-portal="patient">
    <a className="skip-link" href="#patient-main">Skip to content</a>
    <div className="emergency-ribbon"><strong>Safety first · non-emergency service</strong><span>For immediate danger, seek urgent in-person care.</span><div><a href={`tel:${emergencyNumber}`}>Emergency {emergencyNumber}</a><a href={`tel:${helpdeskPhone}`}>FNPH 24/7 support</a></div></div>
    <header className="site-header"><Link className="brand" to="/"><img src="/fnph-logo.png" alt="Federal Neuropsychiatric Hospital Kaduna logo" /><span><b>FNPH Kaduna</b><small>Telepsychiatry · Existing patient</small></span></Link>
      <div className="header-right"><span className="secure-label">Non-emergency follow-up</span><label className="language-picker"><span aria-hidden>文</span><select aria-label="Language"><option>English</option><option>Hausa</option><option>Igbo</option><option>Yorùbá</option><option>العربية</option><option>Français</option></select></label>{principal && <NotificationMenu />}{principal && <Link className="profile-trigger" to="/portal/profile"><span className="profile-avatar">{initials(principal.displayName)}</span><span className="profile-name">{principal.displayName}</span><span aria-hidden>⌄</span></Link>}<Link className="header-help" to="/help">Help &amp; support</Link>{principal ? <button className="header-signout" onClick={() => signOut()}>Sign out</button> : <Link className="header-signout" to="/patients">Patient sign in</Link>}</div>
    </header>
    <div className="journey-shell"><aside className="journey-sidebar"><div className="journey-sidebar-head"><span className="eyebrow">One connected journey</span><h2>From hospital card to continuing care</h2><p>Only verified existing FNPH Kaduna patients who have already been assessed in person can use this non-emergency follow-up route.</p></div><ol>{steps.map(([title, subtitle, route], i) => <li key={title} className={location.pathname === route ? 'active' : ''} aria-current={location.pathname === route ? 'step' : undefined}><span>{String(i + 1).padStart(2, '0')}</span><b>{principal || i < 2 ? <Link to={route}>{title}</Link> : title}</b><small>{subtitle}</small></li>)}</ol>{principal && <Link className="button secondary" to="/portal">My dashboard</Link>}<div className="rail-support"><b>Your health is our concern</b><p>Private, thoughtful care—at a time and place where you can speak comfortably.</p></div></aside>
      <main id="patient-main" className="journey-main"><Suspense fallback={<p>Loading your care information…</p>}>{children}</Suspense></main></div>
  </div>
}

