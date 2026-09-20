import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/lib/api/endpoints/auth'
import { toApiError } from '@/lib/api/http'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { Alert } from '@/components/ui/Alert'
import { PasswordField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { formatDateTime } from '@/lib/format'
import { AuthCard } from './AuthCard'
import { passwordProblems } from '@/lib/passwords'

export function Activate() {
  useDocumentTitle('Set up your account')
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const preview = useQuery({ queryKey: ['activation', token], queryFn: () => authApi.previewActivation(token), enabled: Boolean(token), retry: false })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const min = preview.data?.minimumPasswordLength ?? 12

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const problem = passwordProblems(password, confirm, min, [preview.data?.username ?? '', preview.data?.email?.split('@')[0] ?? '', ...(preview.data?.fullName.split(' ') ?? [])])
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      await authApi.completeActivation(token, password)
      setDone(true)
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  if (!token || preview.isError) {
    return (
      <AuthCard>
        <h1 className="text-2xl font-extrabold">This link cannot be used</h1>
        <p className="mt-2 text-sm text-muted">
          It may have expired, already been used, or been replaced by a newer invitation. Ask Central Administration to resend your invitation.
        </p>
        <Link to="/" className="btn btn-secondary mt-6 w-full no-underline">Go to the home page</Link>
      </AuthCard>
    )
  }

  if (preview.isLoading) {
    return (
      <AuthCard>
        <Spinner label="Checking your invitation" />
      </AuthCard>
    )
  }

  if (done) {
    return (
      <AuthCard>
        <span className="grid size-12 place-items-center rounded-2xl bg-mint text-xl text-forest">
          <i aria-hidden className="bi bi-check2" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold">Your account is ready</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in with <strong className="text-ink">{preview.data?.username}</strong> and your new password.
        </p>
        <Link to="/staff" className="btn btn-primary mt-6 w-full no-underline">Sign in now</Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <form onSubmit={submit} noValidate>
        <span className="kicker">Account setup</span>
        <h1 className="text-2xl font-extrabold">Welcome, {preview.data?.fullName}</h1>
        <p className="mt-2 text-sm text-muted">
          Choose a password for <strong className="text-ink">{preview.data?.username}</strong>. Nobody else, including Central Administration, will ever know it.
        </p>
        <p className="mt-1 text-xs text-muted">This link expires {formatDateTime(preview.data?.expiresAt)} WAT.</p>
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
        <PasswordField wrapperClassName="mt-5" label="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hint={`At least ${min} characters. A short phrase is easier to remember than symbols.`} required />
        <PasswordField wrapperClassName="mt-4" label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        <button className="btn btn-primary mt-6 w-full" type="submit" disabled={busy}>
          {busy ? <Spinner label="Saving" inverted /> : 'Create my password'}
        </button>
      </form>
    </AuthCard>
  )
}
