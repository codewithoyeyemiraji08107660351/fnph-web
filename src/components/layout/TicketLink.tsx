import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'

/** Notification links point at /tickets/{id}; staff go to their queue, everyone else to their own requests. */
export function TicketLink() {
  const { can, principal } = useAuth()
  if (!can('ticket.read')) return <Navigate to="/support" replace />
  const route = principal?.dashboardRoute ?? '/'
  const target = route.startsWith('/ict') ? '/ict/support' : route.startsWith('/admin') ? '/admin/support' : '/helpdesk'
  return <Navigate to={target} replace />
}
