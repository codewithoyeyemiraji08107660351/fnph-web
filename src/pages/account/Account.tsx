import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accountApi } from '@/lib/api/endpoints/account'
import { authApi } from '@/lib/api/endpoints/auth'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { roleName } from '@/lib/auth/roles'
import { formatDateTime, formatRelative } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { TextField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { ChangePasswordForm } from './ChangePasswordForm'

function ProfileForm() {
  const qc = useQueryClient()
  const toast = useToast()
  const { reloadPrincipal } = useAuth()
  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: accountApi.profile })
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phoneNumber: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        firstName: profile.data.firstName ?? '',
        lastName: profile.data.lastName ?? '',
        email: profile.data.email ?? '',
        phoneNumber: profile.data.phoneNumber ?? '',
      })
    }
  }, [profile.data])

  const save = useMutation({
    mutationFn: () => accountApi.updateProfile(form),
    onSuccess: async () => {
      setError(null)
      toast('Your details were saved.')
      await qc.invalidateQueries({ queryKey: ['me', 'profile'] })
      await reloadPrincipal()
    },
    onError: (err) => setError(toApiError(err).message),
  })

  if (profile.isLoading) return <Spinner label="Loading your details" />
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="First name" value={form.firstName} onChange={set('firstName')} autoComplete="given-name" maxLength={100} />
        <TextField label="Last name" value={form.lastName} onChange={set('lastName')} autoComplete="family-name" maxLength={100} />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} autoComplete="email" maxLength={100} hint="Password reset links are sent here." />
        <TextField label="Phone number" type="tel" value={form.phoneNumber} onChange={set('phoneNumber')} autoComplete="tel" maxLength={20} />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Username <strong className="text-ink">{profile.data?.username}</strong>. Last sign in {formatDateTime(profile.data?.lastLoginAt, 'not recorded')}.
        </p>
        <button className="btn btn-primary" type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner label="Saving" inverted /> : 'Save details'}
        </button>
      </div>
    </form>
  )
}

function Sessions() {
  const qc = useQueryClient()
  const toast = useToast()
  const { signOut } = useAuth()
  const [confirmAll, setConfirmAll] = useState(false)
  const sessions = useQuery({ queryKey: ['me', 'sessions'], queryFn: authApi.sessions })
  const revoke = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: () => {
      toast('That device was signed out.')
      void qc.invalidateQueries({ queryKey: ['me', 'sessions'] })
    },
    onError: (err) => toast(toApiError(err).message, 'error'),
  })
  const revokeAll = useMutation({
    mutationFn: authApi.revokeAllSessions,
    onSuccess: () => signOut('You signed out of every device.'),
    onError: (err) => toast(toApiError(err).message, 'error'),
  })

  return (
    <Panel
      title="Signed-in devices"
      bodyClassName=""
      action={
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmAll(true)}>
          Sign out everywhere
        </button>
      }
    >
      {sessions.isLoading && <div className="p-5"><Spinner label="Loading devices" /></div>}
      {sessions.isError && <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />}
      {sessions.data?.length === 0 && <EmptyState icon="bi-laptop" title="No active devices" />}
      <ul className="divide-y divide-line">
        {sessions.data?.map((s) => (
          <li key={s.publicId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <i aria-hidden className={`bi ${/Android|iOS/.test(s.deviceLabel ?? '') ? 'bi-phone' : 'bi-laptop'}`} />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  {s.deviceLabel || 'Unnamed device'} {s.current && <Badge tone="green">This device</Badge>}
                </p>
                <p className="text-xs text-muted">
                  Signed in {formatDateTime(s.signedInAt)}. Last active {formatRelative(s.lastSeenAt ?? s.signedInAt)}. {s.ipAddress && `IP ${s.ipAddress}`}
                </p>
              </div>
            </div>
            {!s.current && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={revoke.isPending} onClick={() => revoke.mutate(s.publicId)}>
                Sign out
              </button>
            )}
          </li>
        ))}
      </ul>
      <Dialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Sign out of every device?"
        busy={revokeAll.isPending}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmAll(false)}>Cancel</button>
            <button className="btn btn-danger" disabled={revokeAll.isPending} onClick={() => revokeAll.mutate()}>
              Sign out everywhere
            </button>
          </>
        }
      >
        <p className="text-sm text-muted">This includes this device. Use it if a phone or computer with your account is lost.</p>
      </Dialog>
    </Panel>
  )
}

export function Account() {
  const { principal } = useAuth()
  if (!principal) return null
  return (
    <>
      <PageHeader kicker="Your account" title="Account and security" description="Your details, password and the devices signed in to this account." />
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <Panel title="Your details">
            <ProfileForm />
          </Panel>
          <Sessions />
        </div>
        <div className="space-y-5">
          <Panel title="Access">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Primary role</dt>
                <dd className="font-bold">{roleName(principal.primaryRole)}</dd>
              </div>
              {principal.roles.length > 1 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Other roles</dt>
                  <dd className="text-right font-bold">{principal.roles.filter((r) => r !== principal.primaryRole).map(roleName).join(', ')}</dd>
                </div>
              )}
              {principal.centreName && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Centre</dt>
                  <dd className="font-bold">{principal.centreName}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Authenticator app</dt>
                <dd>{principal.mfaEnabled ? <Badge tone="green">Enabled</Badge> : principal.scope === 'PATIENT' ? <Badge>Not required</Badge> : <Badge tone="gold">Not set up</Badge>}</dd>
              </div>
            </dl>
            {principal.scope !== 'PATIENT' && (
              <p className="mt-4 text-xs text-muted">Lost your authenticator phone and your recovery codes? Central Administration can reset your second factor.</p>
            )}
          </Panel>
          <Panel title="Change password">
            <ChangePasswordForm />
          </Panel>
        </div>
      </div>
    </>
  )
}
