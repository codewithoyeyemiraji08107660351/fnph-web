import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api/endpoints/admin'
import { accountApi } from '@/lib/api/endpoints/account'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, formatLongDate, formatNaira, formatPhone, formatRelative, humanise, settingLabel } from '@/lib/format'
import { ErrorState, PageHeader, Panel, Stat } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'

const HIGHLIGHT_KEYS = ['consultation_fee_ngn', 'centre_booking_charge_ngn', 'session_minutes_fnph', 'no_show_cutoff_minutes', 'clinical_emergency_number', 'recording_enabled']

export function Overview() {
  const { can, principal } = useAuth()
  const health = useQuery({ queryKey: ['system-health'], queryFn: accountApi.health, enabled: can('system.health_read'), refetchInterval: 60_000 })
  const users = useQuery({ queryKey: ['admin', 'users', 'overview'], queryFn: () => adminApi.users.list({ size: 200 }), enabled: can('user.read') })
  const config = useQuery({ queryKey: ['admin', 'configuration'], queryFn: adminApi.configuration.list, enabled: can('config.read') })
  const recent = useQuery({ queryKey: ['admin', 'audit', 'recent'], queryFn: () => adminApi.audit.search({ size: 8 }), enabled: can('audit.read') })

  const list = users.data ?? []
  const count = (fn: (u: (typeof list)[number]) => boolean) => list.filter(fn).length
  const active = count((u) => u.status === 'ACTIVE')
  const invited = count((u) => u.status === 'INVITED')
  const locked = count((u) => Boolean(u.accountLocked))
  const noMfa = count((u) => u.status === 'ACTIVE' && !u.mfaEnabled)

  const highlights = (config.data ?? []).filter((c) => HIGHLIGHT_KEYS.includes(c.key)).sort((a, b) => HIGHLIGHT_KEYS.indexOf(a.key) - HIGHLIGHT_KEYS.indexOf(b.key))
  const display = (key: string, value: string) =>
    key.endsWith('_ngn') ? formatNaira(value) : key.endsWith('_minutes') ? `${value} min` : key.includes('number') ? formatPhone(value) : value === 'true' ? 'On' : value === 'false' ? 'Off' : value

  return (
    <>
      <PageHeader
        kicker={formatLongDate()}
        title="Whole-system command view"
        description={`Signed in as ${principal?.displayName}. Monitor the platform without changing the clinical authority held by each role.`}
        actions={
          <>
            {can('supervision.view_as') && <Link to="/admin/supervision" className="btn btn-secondary no-underline">Supervised view</Link>}
            {can('user.create') && <Link to="/admin/users" className="btn btn-primary no-underline">Manage users</Link>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Active accounts" value={users.isLoading ? '…' : active} note={list.length >= 200 ? 'First 200 shown' : `${list.length} total`} />
        <Stat label="Invitations pending" value={users.isLoading ? '…' : invited} tone={invited ? 'warn' : 'default'} note="Awaiting password setup" />
        <Stat label="Locked accounts" value={users.isLoading ? '…' : locked} tone={locked ? 'alarm' : 'default'} note="After failed sign-ins" />
        <Stat label="Active without MFA" value={users.isLoading ? '…' : noMfa} tone={noMfa ? 'warn' : 'default'} note="Set up on next sign in" />
        <Stat
          label="Patient enrolment"
          value={health.data ? (health.data.enrolmentAvailable === false ? 'Down' : 'Open') : health.isLoading ? '…' : 'Unknown'}
          tone={health.data?.enrolmentAvailable === false ? 'alarm' : 'default'}
          note={health.data ? `Checked ${formatRelative(health.data.checkedAt as string)}` : 'Needs an active EHR snapshot'}
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Recent activity" action={can('audit.read') && <Link to="/admin/audit" className="text-sm font-bold">Open audit log</Link>} bodyClassName="">
          {recent.isLoading && <div className="p-5"><Spinner label="Loading activity" /></div>}
          {recent.isError && <p className="p-5 text-sm text-alarm">Recent activity could not be loaded.</p>}
          {recent.data && (recent.data.content ?? []).length === 0 && <p className="p-5 text-sm text-muted">No activity in the last 30 days.</p>}
          <ul className="divide-y divide-line">
            {(recent.data?.content ?? []).map((e) => (
              <li key={e.publicId} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-bold">{humanise(e.action)}</p>
                  <p className="text-xs text-muted">
                    {e.systemAction ? 'System' : e.username} {e.entityType ? `on ${humanise(e.entityType)}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs whitespace-nowrap text-muted">{formatDateTime(e.performedAt)}</p>
                  {e.viewAsSessionId && <Badge tone="gold">Supervised</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Key settings" action={can('config.read') && <Link to="/admin/configuration" className="text-sm font-bold">Configure</Link>}>
          {config.isLoading && <Spinner label="Loading settings" />}
          {config.isError && <ErrorState error={config.error} onRetry={() => config.refetch()} />}
          <dl className="divide-y divide-line">
            {highlights.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                <dt className="text-muted">{settingLabel(c.key)}</dt>
                <dd className="font-bold">{display(c.key, c.value)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel title="Where the work is" className="mt-5">
        <div className="flex flex-wrap gap-2">
          {can('appointment.read') && <Link to="/admin/appointments" className="btn btn-secondary btn-sm no-underline">Appointments by day</Link>}
          {can('appointment.read') && <Link to="/admin/cancellations" className="btn btn-secondary btn-sm no-underline">Cancellation requests</Link>}
          {can('ehr_verification.resolve') && <Link to="/admin/verification" className="btn btn-secondary btn-sm no-underline">Enrolment checks</Link>}
          {can('ticket.read') && <Link to="/admin/support" className="btn btn-secondary btn-sm no-underline">Support queue</Link>}
        </div>
        {health.data && <p className="mt-3 text-xs text-muted">Health last checked {formatDateTime(health.data.checkedAt as string)}.</p>}
      </Panel>
    </>
  )
}
