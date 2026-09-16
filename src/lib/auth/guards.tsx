import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { CENTRAL_ADMINISTRATOR, safeDashboardRoute } from './roles'
import { FullPageLoader } from '@/components/ui/Spinner'

/*
  These guards decide what the interface shows. They are not the security
  boundary: the API checks every permission and tenant on every request.
*/

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, principal } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageLoader label="Restoring your session" />
  if (status === 'anonymous' || !principal) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }
  if (principal.mustChangePassword && location.pathname !== '/account/password') {
    return <Navigate to="/account/password" replace />
  }
  return <>{children}</>
}

/**
  Ordinary users reach only their own workspace. The Central Administrator
  reaches another workspace only through an open supervised session, which
  the server records against every request.
*/
export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { principal, hasRole, supervision } = useAuth()
  if (!principal) return null
  if (hasRole(...roles)) return <>{children}</>
  if (hasRole(CENTRAL_ADMINISTRATOR)) {
    if (supervision && roles.includes(supervision.targetRole)) return <>{children}</>
    return <Navigate to="/admin/supervision" replace state={{ notice: 'Open a supervised session to view another workspace.' }} />
  }
  return <Navigate to={safeDashboardRoute(principal.dashboardRoute)} replace />
}

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can, principal, supervision } = useAuth()
  if (!principal) return null
  if (can(permission)) return <>{children}</>
  // Inside a supervised workspace, say why instead of bouncing to the
  // administrator's own dashboard, which reads as the screen being broken.
  if (supervision && window.location.pathname.startsWith(supervision.dashboardRoute)) {
    return (
      <div className="card mx-auto max-w-xl p-6 text-center">
        <p className="font-display text-lg font-extrabold">Not available in a supervised view</p>
        <p className="mt-2 text-sm text-muted">This screen changes records, and supervision is read-only. Nothing here can be done on {supervision.targetFullName}’s behalf.</p>
      </div>
    )
  }
  return <Navigate to={safeDashboardRoute(principal.dashboardRoute)} replace />
}

/** Sends a signed-in person to their own dashboard. */
export function DashboardRedirect() {
  const { status, principal } = useAuth()
  if (status === 'loading') return <FullPageLoader label="Restoring your session" />
  if (!principal) return <Navigate to="/sign-in" replace />
  return <Navigate to={safeDashboardRoute(principal.dashboardRoute)} replace />
}
