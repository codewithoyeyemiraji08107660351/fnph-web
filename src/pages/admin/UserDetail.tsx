import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/api/endpoints/admin'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { CENTRAL_ADMINISTRATOR, roleName } from '@/lib/auth/roles'
import { formatDateTime, initials } from '@/lib/format'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Dialog } from '@/components/ui/Dialog'
import { ReasonField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { useToast } from '@/components/ui/Toast'

type ActionKey = 'resend' | 'resetPassword' | 'revokeSessions' | 'deactivate'

interface ActionSpec {
  title: string
  body: string
  confirm: string
  danger?: boolean
  reasonMin?: number
  permission: string
}

const ACTIONS: Record<ActionKey, ActionSpec> = {
  resend: { title: 'Resend invitation', body: 'A new setup link is emailed and the previous link stops working.', confirm: 'Resend invitation', permission: 'user.create' },
  resetPassword: {
    title: 'Send a password reset',
    body: 'The user receives a reset link by email and must choose a new password. Their current sessions end.',
    confirm: 'Send reset link',
    reasonMin: 10,
    permission: 'user.reset_password',
  },
  revokeSessions: { title: 'Sign out all devices', body: 'Every active session for this user ends immediately.', confirm: 'Sign out all devices', danger: true, permission: 'session.revoke' },
  deactivate: {
    title: 'Deactivate account',
    body: 'The user can no longer sign in. Clinical, financial and audit history they created is kept unchanged.',
    confirm: 'Deactivate account',
    danger: true,
    reasonMin: 10,
    permission: 'user.deactivate',
  },
}

function RoleEditor({ userId }: { userId: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()
  const assignment = useQuery({ queryKey: ['admin', 'user-roles', userId], queryFn: () => adminApi.users.roles(userId) })
  const catalogue = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => adminApi.roles.list() })
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [primary, setPrimary] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const begin = () => {
    const held = assignment.data?.roles ?? []
    setSelected(held.map((r) => r.code))
    setPrimary(held.find((r) => r.primary)?.code ?? held[0]?.code ?? '')
    setReason('')
    setError(null)
    setEditing(true)
  }

  const save = useMutation({
    mutationFn: () => adminApi.users.assignRoles(userId, { roleCodes: selected, primaryRoleCode: primary, reason: reason.trim() }),
    onSuccess: () => {
      toast('Roles updated. The change applies from the user’s next request.')
      setEditing(false)
      void qc.invalidateQueries({ queryKey: ['admin', 'user-roles', userId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: (err) => setError(toApiError(err).message),
  })

  const toggle = (code: string) =>
    setSelected((list) => {
      const next = list.includes(code) ? list.filter((c) => c !== code) : [...list, code]
      if (!next.includes(primary)) setPrimary(next[0] ?? '')
      return next
    })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!selected.length) return setError('Keep at least one role.')
    if (!primary) return setError('Choose the primary role. It decides which workspace opens at sign in.')
    if (reason.trim().length < 10) return setError('Give a reason of at least 10 characters.')
    save.mutate()
  }

  const heldScope = catalogue.data?.find((r) => r.code === assignment.data?.primaryRole)?.scope
  const options = (catalogue.data ?? []).filter((r) => r.active && r.scope !== 'PATIENT' && (!heldScope || r.scope === heldScope))

  return (
    <Panel
      title="Roles"
      action={can('role.assign') && assignment.data && <button className="btn btn-secondary btn-sm" onClick={begin}>Change roles</button>}
    >
      {assignment.isLoading && <Spinner label="Loading roles" />}
      {assignment.isError && <ErrorState error={assignment.error} onRetry={() => assignment.refetch()} />}
      {assignment.data && (
        <>
          <ul className="space-y-3">
            {assignment.data.roles.map((r) => (
              <li key={r.code} className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">
                    {r.name} {r.primary && <Badge tone="navy">Primary</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    Granted {formatDateTime(r.grantedAt)} {r.grantedBy ? `by ${r.grantedBy}` : ''}
                    {r.grantReason ? `. ${r.grantReason}` : ''}
                  </p>
                </div>
                <Link to={`/admin/roles/${encodeURIComponent(r.code)}`} className="text-xs font-bold">View permissions</Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            {assignment.data.effectivePermissions.length} effective permissions. Opens at <code>{assignment.data.dashboardRoute}</code>.
          </p>
        </>
      )}
      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        busy={save.isPending}
        title="Change roles"
        description="Scopes cannot be mixed. A centre account keeps centre roles only."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary" type="submit" form="role-form" disabled={save.isPending}>
              {save.isPending ? <Spinner label="Saving" inverted /> : 'Save roles'}
            </button>
          </>
        }
      >
        <form id="role-form" onSubmit={submit} noValidate>
          {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
          <fieldset>
            <legend className="field-label">Roles held</legend>
            <ul className="divide-y divide-line rounded-[14px] border border-line">
              {options.map((r) => (
                <li key={r.code} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={selected.includes(r.code)} onChange={() => toggle(r.code)} />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{r.name}</span>
                      <span className="block text-xs text-muted">{r.description}</span>
                    </span>
                  </label>
                  <label className={`flex items-center gap-1.5 text-xs ${selected.includes(r.code) ? '' : 'invisible'}`}>
                    <input type="radio" name="primary" className="accent-[var(--accent)]" checked={primary === r.code} onChange={() => setPrimary(r.code)} />
                    Primary
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {selected.includes(CENTRAL_ADMINISTRATOR) && (
            <Alert tone="warning" className="mt-4">Central Administrator grants system-wide access, including supervised access to every workspace.</Alert>
          )}
          <div className="mt-4">
            <ReasonField value={reason} onChange={setReason} min={10} />
          </div>
        </form>
      </Dialog>
    </Panel>
  )
}

function ContactEditor({ userId, initial }: { userId: string; initial: { fullName: string; email?: string; phoneNumber?: string } }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()
  const [open, setOpen] = useState(false)
  const [first, ...rest] = initial.fullName.split(' ')
  const [form, setForm] = useState({ firstName: first, lastName: rest.join(' '), email: initial.email ?? '', phoneNumber: initial.phoneNumber ?? '' })
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => adminApi.users.updateContact(userId, form),
    onSuccess: () => {
      toast('Contact details saved.')
      setOpen(false)
      void qc.invalidateQueries({ queryKey: ['admin', 'user', userId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: (err) => setError(toApiError(err).message),
  })

  return (
    <>
      <Panel title="Contact details" action={can('user.update') && <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>Edit</button>}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted">Email</dt><dd className="font-bold break-all">{initial.email || 'Not recorded'}</dd></div>
          <div><dt className="text-xs text-muted">Phone</dt><dd className="font-bold">{initial.phoneNumber || 'Not recorded'}</dd></div>
        </dl>
      </Panel>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        busy={save.isPending}
        title="Edit contact details"
        description="Changing the email changes where reset links go. Confirm the new address with the person first."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Spinner label="Saving" inverted /> : 'Save details'}
            </button>
          </>
        }
      >
        {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <TextField label="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="Phone" type="tel" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
        </div>
      </Dialog>
    </>
  )
}

export function UserDetail() {
  const { userId = '' } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const { can, principal } = useAuth()
  const user = useQuery({ queryKey: ['admin', 'user', userId], queryFn: () => adminApi.users.get(userId) })
  const [action, setAction] = useState<ActionKey | null>(null)
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const run = useMutation({
    mutationFn: async (key: ActionKey) => {
      switch (key) {
        case 'resend': return adminApi.users.resendInvitation(userId)
        case 'resetPassword': return adminApi.users.resetPassword(userId, reason.trim())
        case 'revokeSessions': return adminApi.users.revokeSessions(userId)
        case 'deactivate': return adminApi.users.deactivate(userId, reason.trim())
      }
    },
    onSuccess: (_d, key) => {
      toast(`${ACTIONS[key].title} completed.`)
      setAction(null)
      setReason('')
      void qc.invalidateQueries({ queryKey: ['admin', 'user', userId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: (err) => setActionError(toApiError(err).message),
  })

  if (user.isLoading) return <Spinner label="Loading user" />
  if (user.isError || !user.data) return <ErrorState error={user.error} onRetry={() => user.refetch()} />
  const u = user.data
  const isSelf = u.publicId === principal?.publicId
  const spec = action ? ACTIONS[action] : null

  const available = (Object.keys(ACTIONS) as ActionKey[]).filter((k) => {
    if (!can(ACTIONS[k].permission)) return false
    if (k === 'resend') return u.status === 'INVITED'
    if (k === 'deactivate') return u.status !== 'DEACTIVATED' && !isSelf
    if (k === 'resetPassword') return u.status === 'ACTIVE'
    return u.status !== 'DEACTIVATED'
  })

  return (
    <>
      <Link to="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold no-underline">
        <i aria-hidden className="bi bi-arrow-left" /> All users
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-accent font-display text-lg font-bold text-white">{initials(u.fullName)}</span>
        <div className="min-w-0 flex-1">
          <PageHeader title={u.fullName} />
          <div className="-mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{u.username}</span>
            <StatusBadge status={u.status} />
            {u.accountLocked && <Badge tone="red">Locked after failed sign-ins</Badge>}
          </div>
        </div>
        {can('supervision.view_as') && !isSelf && u.status === 'ACTIVE' && !u.roles.includes(CENTRAL_ADMINISTRATOR) && (
          <button className="btn btn-secondary" onClick={() => navigate('/admin/supervision', { state: { targetId: u.publicId } })}>
            <i aria-hidden className="bi bi-eye" /> Supervise this workspace
          </button>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <ContactEditor key={`${u.fullName}|${u.email}|${u.phoneNumber}`} userId={userId} initial={{ fullName: u.fullName, email: u.email, phoneNumber: u.phoneNumber }} />
          <RoleEditor userId={userId} />
        </div>
        <div className="space-y-5">
          <Panel title="Sign-in activity">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Last sign in</dt><dd className="font-bold">{formatDateTime(u.lastLoginAt, 'Never')}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Recent failed attempts</dt><dd className="font-bold">{u.failedLoginAttempts ?? 0}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Current roles</dt><dd className="text-right font-bold">{u.roles.map(roleName).join(', ')}</dd></div>
            </dl>
            {u.accountLocked && (
              <p className="mt-4 rounded-[12px] bg-blush px-3 py-2.5 text-xs text-alarm-700">
                A lockout was applied after repeated failed sign-ins. It lifts by itself when the lockout period ends, and a password reset clears it at once. Check with the user before resetting, in case the attempts were not theirs.
              </p>
            )}
          </Panel>
          <Panel title="Account actions">
            {available.length === 0 ? (
              <p className="text-sm text-muted">{u.status === 'DEACTIVATED' ? 'This account is deactivated. Its history is preserved.' : 'No actions available with your permissions.'}</p>
            ) : (
              <ul className="space-y-2">
                {available.map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null)
                        setReason('')
                        setAction(k)
                      }}
                      className={`flex w-full items-center justify-between rounded-[12px] border px-4 py-3 text-left text-sm font-bold ${ACTIONS[k].danger ? 'border-[#e9c3c0] text-alarm hover:bg-blush' : 'border-line text-ink hover:border-accent'}`}
                    >
                      {ACTIONS[k].title}
                      <i aria-hidden className="bi bi-chevron-right text-xs" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {spec && action && (
        <Dialog
          open
          onClose={() => setAction(null)}
          busy={run.isPending}
          title={`${spec.title}: ${u.fullName}`}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setAction(null)}>Cancel</button>
              <button
                className={`btn ${spec.danger ? 'btn-danger' : 'btn-primary'}`}
                disabled={run.isPending || (spec.reasonMin ? reason.trim().length < spec.reasonMin : false)}
                onClick={() => run.mutate(action)}
              >
                {run.isPending ? <Spinner label="Working" inverted /> : spec.confirm}
              </button>
            </>
          }
        >
          <p className="text-sm text-muted">{spec.body}</p>
          {actionError && <Alert tone="danger" className="mt-4">{actionError}</Alert>}
          {spec.reasonMin && (
            <div className="mt-4">
              <ReasonField value={reason} onChange={setReason} min={spec.reasonMin} />
            </div>
          )}
        </Dialog>
      )}
    </>
  )
}
