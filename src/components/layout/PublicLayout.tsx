import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brand } from '@/components/ui/Brand'
import { SafetyRibbon } from './SafetyRibbon'
import { useAuth } from '@/lib/auth/AuthProvider'
import { safeDashboardRoute } from '@/lib/auth/roles'
import { PatientExperience } from '@/features/patient/PatientExperience'

const NAV = [
  { to: '/patients', label: 'Patients' },
  { to: '/staff', label: 'Hospital staff' },
  { to: '/centres', label: 'Centres of Excellence' },
  { to: '/help', label: 'Help' },
]

export function PublicLayout() {
  const { principal } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  // The menu closes on every navigation, including back and forward.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [location.pathname])

  if (location.pathname === '/') return <Outlet />
  if (['/enrol', '/patients'].includes(location.pathname)) return <PatientExperience><Outlet /></PatientExperience>

  return (
    <div className="flex min-h-dvh flex-col" data-portal="patient">
      <SafetyRibbon />
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-[1320px] items-center justify-between gap-6 px-4 sm:px-5">
          <Brand />
          <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => `text-sm font-bold no-underline ${isActive ? 'text-forest' : 'text-[#46544e] hover:text-forest'}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden lg:block">
            {principal ? (
              <Link to={safeDashboardRoute(principal.dashboardRoute)} className="btn btn-primary no-underline" data-portal="core">
                Open my workspace
              </Link>
            ) : (
              <Link to="/staff" className="btn no-underline bg-navy text-white hover:bg-navy-900">
                Staff sign in
              </Link>
            )}
          </div>
          <button type="button" className="btn btn-secondary lg:hidden" aria-expanded={open} aria-controls="public-menu" onClick={() => setOpen((v) => !v)}>
            <i aria-hidden className={`bi ${open ? 'bi-x-lg' : 'bi-list'}`} />
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
        {open && (
          <nav id="public-menu" aria-label="Main" className="border-t border-line bg-white px-4 pt-2 pb-4 lg:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className="block rounded-xl px-3 py-3 font-bold text-ink no-underline hover:bg-soft">
                {n.label}
              </NavLink>
            ))}
            <Link to={principal ? safeDashboardRoute(principal.dashboardRoute) : '/staff'} className="btn btn-primary mt-2 w-full no-underline">
              {principal ? 'Open my workspace' : 'Staff sign in'}
            </Link>
          </nav>
        )}
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-5 py-6 text-xs text-muted sm:flex-row sm:justify-between">
          <span>Federal Neuropsychiatric Hospital Kaduna</span>
          <span className="flex gap-4">
            <Link to="/help" className="text-muted">Help and privacy</Link>
            <Link to="/verify" className="text-muted">Check a prescription</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
