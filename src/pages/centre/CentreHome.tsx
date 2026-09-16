import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { centreApi } from '@/lib/api/endpoints/centre'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, formatLongDate, humanise } from '@/lib/format'
import { ErrorState, PageHeader, Panel, Stat } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { AppointmentBadge } from '@/components/ui/AppointmentBadge'
import { Spinner } from '@/components/ui/Spinner'

export function CentreHome() {
  const { can } = useAuth()
  const me = useQuery({ queryKey: ['centre-me'], queryFn: centreApi.me })
  const appts = useQuery({ queryKey: ['centre-appointments'], queryFn: centreApi.appointments, enabled: can('centre_referral.read') })
  if (me.isLoading) return <Spinner label="Loading your centre" />
  if (me.isError || !me.data) return <ErrorState error={me.error} onRetry={() => me.refetch()} />
  const c = me.data
  const u = c.utilisation
  const upcoming = (appts.data ?? []).filter((a) => a.status === 'APPROVED' || a.status === 'IN_PROGRESS' || a.status === 'AWAITING_APPROVAL').slice(0, 5)
  return (
    <>
      <PageHeader
        kicker={formatLongDate()}
        title={c.name}
        description={`${c.code}${c.lga ? `, ${c.lga}` : ''}. Specialist consultations with FNPH Kaduna for patients registered at this centre.`}
        actions={
          can('centre_referral.create') && (
            <Link to="/centre/patients" className="btn btn-primary no-underline">
              <i aria-hidden className="bi bi-person-plus" /> Refer a patient
            </Link>
          )
        }
      />
      {c.status !== 'ACTIVE' && <p className="mb-5 rounded-[14px] bg-amber-note px-4 py-3 text-sm text-gold-700">This centre is {humanise(c.status).toLowerCase()}. Referrals cannot be scheduled until FNPH activates it.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Referrals awaiting a time" value={u.referralsAwaitingScheduling} />
        <Stat label="Consultations scheduled" value={u.referralsScheduled} />
        <Stat label="Consultations completed" value={u.consultationsCompleted} />
        <Stat label="Care bundles to act on" value={u.bundlesAwaitingAction} tone={u.bundlesAwaitingAction ? 'warn' : 'default'} />
      </div>
      <p className="mt-2 text-xs text-muted">This centre’s figures only. No amounts are shown here; funding is managed by FNPH Finance.</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Coming up" action={<Link to="/centre/consultations" className="text-sm font-bold">All consultations</Link>} bodyClassName="">
          {appts.isLoading && <div className="p-5"><Spinner /></div>}
          {appts.data && upcoming.length === 0 && <p className="px-5 py-4 text-sm text-muted">Nothing scheduled.</p>}
          <ul className="divide-y divide-line">
            {upcoming.map((a) => (
              <li key={a.publicId} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span>
                  <span className="block font-bold">{a.patientName}</span>
                  <span className="block text-xs text-muted">{formatDateTime(a.appointmentDate)} WAT. {a.reference}</span>
                </span>
                <AppointmentBadge status={a.status} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Services at this centre">
          <ul className="space-y-2 text-sm">
            {c.capabilities.map((cap) => (
              <li key={cap.capability} className="flex items-center justify-between">
                <span>{humanise(cap.capability)}</span>
                {cap.enabled ? <Badge tone="green">Running</Badge> : <Badge>Not run here</Badge>}
              </li>
            ))}
            {c.capabilities.length === 0 && <li className="text-muted">No optional services are set up.</li>}
          </ul>
        </Panel>
      </div>
    </>
  )
}
