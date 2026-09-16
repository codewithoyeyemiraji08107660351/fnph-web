import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { ADMIN_NAV, CENTRAL_ADMINISTRATOR, PORTAL_LABEL, ROLE_BY_CODE, portalForScope, roleName, type NavItem } from '@/lib/auth/roles'
import { Brand } from '@/components/ui/Brand'
import { initials, parseServerTime } from '@/lib/format'
import { useNow } from '@/lib/hooks/useNow'
import { NotificationMenu } from './NotificationMenu'
import { InactivityGuard } from './InactivityGuard'
import { SafetyRibbon, StaffRibbon } from './SafetyRibbon'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/ui/Spinner'

function useNavigation(): NavItem[] {
  const { principal, canOwn, supervision } = useAuth()
  if (!principal) return []
  if (principal.roles.includes(CENTRAL_ADMINISTRATOR)) {
    // The administrator's own menu follows their own permissions, even mid-supervision.
    const items = ADMIN_NAV.filter((n) => !n.permission || canOwn(n.permission))
    const supervised = supervision ? ROLE_BY_CODE[supervision.targetRole] : undefined
    return supervised ? [...items, ...supervised.nav.map((n) => ({ ...n, label: `${n.label} (supervised)` }))] : items
  }
  const seen = new Set<string>()
  return principal.roles
    .flatMap((code) => ROLE_BY_CODE[code]?.nav ?? [])
    .filter((n) => (seen.has(n.to) ? false : (seen.add(n.to), true)))
}

function SupervisionBanner() {
  const { supervision, endSupervision } = useAuth()
  const now = useNow(1000)
  const toast = useToast()
  const navigate = useNavigate()
  if (!supervision) return null
  const expires = parseServerTime(supervision.expiresAt)?.getTime() ?? now
  const left = Math.max(0, Math.floor((expires - now) / 1000))
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-gold-700 px-4 py-2 text-sm text-white sm:px-6">
      <p className="m-0">
        <i aria-hidden className="bi bi-eye-fill mr-2" />
        Supervising <strong>{supervision.targetFullName}</strong> ({roleName(supervision.targetRole)}). Every action is recorded.{' '}
        <span className="tabular-nums opacity-90">
          Ends in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </span>
      </p>
      <button
        type="button"
        className="btn btn-sm border border-white/40 bg-white/10 text-white hover:bg-white/20"
        onClick={async () => {
          try {
            await endSupervision()
            toast('Supervised session closed.')
          } catch {
            toast('The session was closed here. The server will expire it on schedule.', 'info')
          }
          navigate('/admin/supervision')
        }}
      >
        End supervision
      </button>
    </div>
  )
}

function UserMenu() {
  const { principal, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  if (!principal) return null
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-2.5 rounded-[12px] py-1 pr-2 pl-1 hover:bg-soft">
        <span className="grid size-10 place-items-center rounded-full bg-accent text-sm font-bold text-white">{initials(principal.displayName)}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-[180px] truncate text-sm font-bold">{principal.displayName}</span>
          <span className="block max-w-[180px] truncate text-xs text-muted">{principal.centreName ?? roleName(principal.primaryRole)}</span>
        </span>
        <i aria-hidden className="bi bi-chevron-down hidden text-xs text-muted md:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-[16px] border border-line bg-white py-1.5 shadow-[var(--shadow-lift)]">
          <Link to="/account" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink no-underline hover:bg-soft">
            <i aria-hidden className="bi bi-person-gear" /> Account and security
          </Link>
          <button type="button" onClick={() => signOut()} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-alarm hover:bg-blush">
            <i aria-hidden className="bi bi-box-arrow-right" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function AppShell() {
  const { principal, signOut, canOwn } = useAuth()
  const nav = useNavigation()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMenuOpen(false), [location.pathname])
  useEffect(() => {
    if (!menuOpen) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [menuOpen])

  if (!principal) return null
  const portal = portalForScope(principal.scope)
  // Exact match first, then the closest parent, so deep pages keep their section name.
  const current =
    nav.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))) ??
    [...nav].sort((a, b) => b.to.length - a.to.length).find((n) => location.pathname.startsWith(`${n.to}/`))

  return (
    <div data-portal={portal} className="min-h-dvh bg-canvas">
      <a href="#workspace" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>

      {menuOpen && <div className="fixed inset-0 z-40 bg-navy-900/40 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden />}

      <aside
        id="app-sidebar"
        aria-label="Workspace navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-accent-strong text-white transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-5">
          <Brand inverted subtitle={PORTAL_LABEL[portal]} to={principal.dashboardRoute} />
          <button type="button" className="grid size-10 place-items-center rounded-lg text-xl text-white/80 hover:bg-white/10 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <i aria-hidden className="bi bi-x-lg" />
          </button>
        </div>
        {principal.centreName && (
          <div className="mx-4 mt-4 rounded-xl bg-white/10 px-3 py-2.5 text-xs">
            <span className="block text-white/60">Centre</span>
            <span className="font-bold">{principal.centreName}</span>
          </div>
        )}
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-sm font-semibold no-underline ${isActive ? 'bg-white text-accent-strong' : 'text-white/80 hover:bg-white/10 hover:text-white'}`
                  }
                >
                  <i aria-hidden className={`bi ${item.icon} text-base`} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-white/10 p-3">
          {canOwn('ticket.create') && (
            <NavLink to="/support" className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-sm font-semibold no-underline ${isActive ? 'bg-white text-accent-strong' : 'text-white/80 hover:bg-white/10'}`}>
              <i aria-hidden className="bi bi-life-preserver" /> Get help
            </NavLink>
          )}
          <NavLink to="/account" className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-sm font-semibold no-underline ${isActive ? 'bg-white text-accent-strong' : 'text-white/80 hover:bg-white/10'}`}>
            <i aria-hidden className="bi bi-person-gear" /> Account and security
          </NavLink>
          <button type="button" onClick={() => signOut()} className="flex min-h-11 w-full items-center gap-3 rounded-[12px] px-3 text-left text-sm font-semibold text-white/80 hover:bg-white/10">
            <i aria-hidden className="bi bi-box-arrow-right" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-[272px]">
        {portal === 'patient' ? <SafetyRibbon compact /> : <StaffRibbon />}
        <SupervisionBanner />
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex h-[70px] items-center gap-3 px-4 sm:px-6">
            <button type="button" className="grid size-11 place-items-center rounded-[12px] border border-line text-lg lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen} aria-controls="app-sidebar">
              <i aria-hidden className="bi bi-list" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.68rem] font-extrabold tracking-[0.12em] text-accent uppercase">{roleName(principal.primaryRole)}</p>
              <p className="truncate font-display font-bold">{current?.label ?? 'Workspace'}</p>
            </div>
            <NotificationMenu />
            <UserMenu />
          </div>
        </header>
        <main id="workspace" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Suspense fallback={<Spinner label="Loading" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <InactivityGuard />
    </div>
  )
}
