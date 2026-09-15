import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { adminApi } from '@/lib/api/endpoints/admin'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { CENTRAL_ADMINISTRATOR, ROLE_BY_CODE, roleName, safeDashboardRoute } from '@/lib/auth/roles'
import { formatDateTime, formatTime, initials } from '@/lib/format'
import { PageHeader, Panel } from '@/components/ui/Page'
import { ReasonField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

export function Supervision() {
  const { supervision, startSupervision, endSupervision } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const state = (location.state ?? {}) as { targetId?: string; notice?: string }
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState('')
  const [targetId, setTargetId] = useState(state.targetId ?? '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const candidates = useQuery({
    queryKey: ['admin', 'users', 'supervision', search],
    queryFn: () => adminApi.users.list({ term: search, status: 'ACTIVE', size: 20 }),
  })
  const preset = useQuery({ queryKey: ['admin', 'user', state.targetId], queryFn: () => adminApi.users.get(state.targetId as string), enabled: Boolean(state.targetId) })

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(term.trim()), 300)
    return () => window.clearTimeout(t)
  }, [term])

  const list = (candidates.data ?? []).filter((u) => !u.roles.includes(CENTRAL_ADMINISTRATOR))
  const target = list.find((u) => u.publicId === targetId) ?? (preset.data?.publicId === targetId ? preset.data : undefined)

  const start = useMutation({
    mutationFn: () => startSupervision(targetId, reason.trim()),
    onSuccess: (session) => {
      toast(`Supervised session opened for ${session.targetFullName}.`)
      setReason('')
      if (ROLE_BY_CODE[session.targetRole]) navigate(safeDashboardRoute(session.dashboardRoute))
    },
    onError: (err) => setError(toApiError(err).message),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!targetId) return setError('Choose the account whose workspace you need to see.')
    if (reason.trim().length < 15) return setError('Give a reason of at least 15 characters. It is stored with every action you take.')
    setError(null)
    start.mutate()
  }

  return (
    <>
      <PageHeader
        kicker="Supervised access"
        title="View an authorised workspace"
        description="Open another role’s workspace to answer a support question or review a workflow. Sessions last up to 30 minutes and every request made during one is recorded against it."
      />
      {state.notice && <Alert tone="info" className="mb-5">{state.notice}</Alert>}

      {supervision ? (
        <Panel className="border-gold/50">
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid size-14 place-items-center rounded-full bg-gold-700 font-display text-lg font-bold text-white">{initials(supervision.targetFullName)}</span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-extrabold">{supervision.targetFullName}</p>
              <p className="text-sm text-muted">
                {roleName(supervision.targetRole)}. Opened {formatDateTime(supervision.startedAt)}, ends {formatTime(supervision.expiresAt)} WAT.
              </p>
              <p className="mt-1 text-sm">Reason: {supervision.reason}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ROLE_BY_CODE[supervision.targetRole] && (
                <Link to={safeDashboardRoute(supervision.dashboardRoute)} className="btn btn-primary no-underline">Open workspace</Link>
              )}
              <button
                className="btn btn-secondary"
                onClick={async () => {
                  await endSupervision().catch(() => undefined)
                  toast('Supervised session closed.')
                }}
              >
                End session
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted">Only one supervised session can be open at a time. End this one to supervise another account.</p>
        </Panel>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Panel title="1. Choose the account" bodyClassName="">
            <div className="border-b border-line p-4">
              <label className="relative block">
                <span className="sr-only">Search active users</span>
                <i aria-hidden className="bi bi-search absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                <input className="input pl-10" placeholder="Search active staff and centre users" value={term} onChange={(e) => setTerm(e.target.value)} />
              </label>
            </div>
            {candidates.isLoading && <div className="p-5"><Spinner label="Searching" /></div>}
            {candidates.isSuccess && list.length === 0 && <p className="p-5 text-sm text-muted">No active accounts match.</p>}
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto" role="radiogroup" aria-label="Account to supervise">
              {list.map((u) => (
                <li key={u.publicId}>
                  <label className={`flex cursor-pointer items-center gap-3 px-5 py-3 ${targetId === u.publicId ? 'bg-accent-soft' : 'hover:bg-soft/60'}`}>
                    <input type="radio" name="target" className="accent-[var(--accent)]" checked={targetId === u.publicId} onChange={() => setTargetId(u.publicId)} />
                    <span className="grid size-9 place-items-center rounded-full bg-white text-xs font-bold text-accent">{initials(u.fullName)}</span>
                    <span className="min-w-0">
                      <span className="block font-bold">{u.fullName}</span>
                      <span className="block truncate text-xs text-muted">{u.roles.map(roleName).join(', ')}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="2. Record why">
            {target ? (
              <p className="mb-4 rounded-[12px] bg-soft px-3 py-2.5 text-sm">
                Supervising <strong>{target.fullName}</strong> ({target.roles.map(roleName).join(', ')})
              </p>
            ) : (
              <p className="mb-4 text-sm text-muted">Select an account first.</p>
            )}
            {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
            <ReasonField value={reason} onChange={setReason} min={15} label="Reason for supervised access" />
            <button type="submit" className="btn btn-primary mt-5 w-full" disabled={start.isPending || !targetId}>
              {start.isPending ? <Spinner label="Opening" inverted /> : 'Open supervised view'}
            </button>
            <p className="mt-3 text-xs text-muted">You act with your own authority. The session never lets you sign in as the other person or change what they authored.</p>
          </Panel>
        </form>
      )}
    </>
  )
}
