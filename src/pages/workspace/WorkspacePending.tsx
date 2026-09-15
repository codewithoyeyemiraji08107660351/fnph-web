import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { ROLE_BY_CODE, type RoleDefinition } from '@/lib/auth/roles'
import { PageHeader, Panel } from '@/components/ui/Page'
import { formatLongDate } from '@/lib/format'

/**
  Holds the role's route so sign-in, routing and supervision work end to end
  while the workspace itself is built in its phase.
*/
export function WorkspacePending({ roles }: { roles: string[] }) {
  const { principal, supervision } = useAuth()
  const code = supervision && roles.includes(supervision.targetRole) ? supervision.targetRole : (principal?.roles.find((r) => roles.includes(r)) ?? roles[0])
  const role: RoleDefinition | undefined = ROLE_BY_CODE[code]
  if (!role) return null
  const firstName = principal?.displayName.split(' ')[0]
  return (
    <>
      <PageHeader
        kicker={formatLongDate()}
        title={supervision ? `${role.name} workspace` : `Welcome, ${firstName}`}
        description={supervision ? `Supervised view of ${supervision.targetFullName}.` : `You are signed in to the ${role.name} workspace.`}
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="What this workspace will handle">
          <ul className="space-y-3">
            {role.responsibilities.map((r) => (
              <li key={r} className="flex gap-3 text-sm">
                <i aria-hidden className="bi bi-check2-circle mt-0.5 text-accent" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-xl text-accent">
            <i aria-hidden className="bi bi-hourglass-split" />
          </span>
          <p className="mt-4 font-display text-lg font-extrabold">Opening in Phase {role.phase}</p>
          <p className="mt-1 text-sm text-muted">
            {supervision
              ? 'Routing, access and supervision for this role work end to end. Its queues and tools arrive in the next release.'
              : 'Your account and access are active. The queues and tools for this role are being released next. You will be notified when they are ready.'}
          </p>
          {!supervision && (
            <Link to="/account" className="btn btn-secondary mt-5 no-underline">
              Review account security
            </Link>
          )}
        </Panel>
      </div>
    </>
  )
}
