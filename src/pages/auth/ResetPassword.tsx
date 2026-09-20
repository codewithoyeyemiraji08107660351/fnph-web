import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@/lib/api/endpoints/auth'
import { toApiError } from '@/lib/api/http'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { Alert } from '@/components/ui/Alert'
import { PasswordField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { AuthCard } from './AuthCard'
import { passwordProblems } from '@/lib/passwords'

export function ResetPassword() {
  useDocumentTitle('Choose a new password')
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const patient = params.get('from') === 'patient'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const problem = passwordProblems(password, confirm, 12)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <AuthCard>
        <h1 className="text-2xl font-extrabold">This link is incomplete</h1>
        <p className="mt-2 text-sm text-muted">{patient ? 'Return to patient password recovery and enter your EHR number again.' : 'Open the reset link from your email again, or request a new one.'}</p>
        <Link to={patient ? '/forgot-password?from=patient' : '/forgot-password'} className="btn btn-primary mt-6 w-full no-underline">Start again</Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      {done ? (
        <>
          <h1 className="text-2xl font-extrabold">Password changed</h1>
          <p className="mt-2 text-sm text-muted">Every device that was signed in to your account has been signed out. Sign in with your new password.</p>
          <Link to={patient ? '/patients' : '/staff'} className="btn btn-primary mt-6 w-full no-underline">Go to sign in</Link>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <h1 className="text-2xl font-extrabold">Choose a new password</h1>
          {error && (
            <Alert tone="danger" className="mt-4">
              {error} {error.toLowerCase().includes('expired') && <Link to={patient ? '/forgot-password?from=patient' : '/forgot-password'}>Start again.</Link>}
            </Alert>
          )}
          <PasswordField wrapperClassName="mt-5" label="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hint="At least 12 characters." required />
          <PasswordField wrapperClassName="mt-4" label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          <button className="btn btn-primary mt-6 w-full" type="submit" disabled={busy}>
            {busy ? <Spinner label="Saving" inverted /> : 'Save new password'}
          </button>
        </form>
      )}
    </AuthCard>
  )
}
