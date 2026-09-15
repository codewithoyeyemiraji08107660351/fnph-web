import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api/endpoints/admin'
import type { RoleScope } from '@/lib/api/types'
import { humanise } from '@/lib/format'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'

const SCOPES: Array<{ scope: RoleScope; label: string; note: string }> = [
  { scope: 'FNPH', label: 'FNPH Core Engine', note: 'Hospital staff roles' },
  { scope: 'CENTRE', label: 'Centres of Excellence', note: 'Limited to the account’s own centre' },
  { scope: 'PATIENT', label: 'Patient portal', note: 'Self-enrolled with an EHR number' },
]

export function Roles() {
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => adminApi.roles.list() })
  return (
    <>
      <PageHeader
        kicker="Access control"
        title="Roles and permissions"
        description="The permission matrix is held as data and checked by the server on every request. This view is read-only; roles are granted per user."
      />
      {roles.isLoading && <Spinner label="Loading roles" />}
      {roles.isError && <ErrorState error={roles.error} onRetry={() => roles.refetch()} />}
      <div className="space-y-5">
        {roles.data &&
          SCOPES.map(({ scope, label, note }) => {
            const list = roles.data.filter((r) => r.scope === scope)
            if (!list.length) return null
            return (
              <Panel key={scope} title={<span>{label} <span className="ml-2 text-xs font-normal text-muted">{note}</span></span>} bodyClassName="">
                <ul className="divide-y divide-line">
                  {list.map((r) => (
                    <li key={r.code}>
                      <Link to={`/admin/roles/${encodeURIComponent(r.code)}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-ink no-underline hover:bg-soft/60">
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2 font-bold">
                            {r.name} {!r.active && <Badge tone="grey">Inactive</Badge>}
                          </span>
                          <span className="mt-0.5 block text-sm text-muted">{r.description}</span>
                        </span>
                        <span className="flex items-center gap-3 text-sm text-muted">
                          <code className="rounded bg-soft px-1.5 py-0.5 text-xs">{r.dashboardRoute}</code>
                          <span className="font-bold text-ink">{r.permissionCount}</span> permissions
                          <i aria-hidden className="bi bi-chevron-right text-xs" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )
          })}
      </div>
    </>
  )
}

export function RoleDetail() {
  const { code = '' } = useParams()
  const role = useQuery({ queryKey: ['admin', 'role', code], queryFn: () => adminApi.roles.get(code) })
  if (role.isLoading) return <Spinner label="Loading role" />
  if (role.isError || !role.data) return <ErrorState error={role.error} onRetry={() => role.refetch()} />
  const r = role.data
  const modules = Object.entries(r.permissionsByModule).sort(([a], [b]) => a.localeCompare(b))
  return (
    <>
      <Link to="/admin/roles" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold no-underline">
        <i aria-hidden className="bi bi-arrow-left" /> All roles
      </Link>
      <PageHeader kicker={`${r.scope} scope`} title={r.name} description={r.description} />
      <p className="-mt-3 mb-6 text-sm text-muted">
        {r.permissionCount} permissions across {modules.length} modules. Signs in to <code>{r.dashboardRoute}</code>.
      </p>
      <div className="columns-1 gap-5 md:columns-2 xl:columns-3">
        {modules.map(([module, perms]) => (
          <Panel key={module} title={humanise(module)} className="mb-5 break-inside-avoid">
            <ul className="space-y-2.5">
              {perms.map((p) => (
                <li key={p.code} className="text-sm">
                  <code className="text-xs font-bold text-accent">{p.code}</code>
                  {p.description && <p className="text-muted">{p.description}</p>}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  )
}
