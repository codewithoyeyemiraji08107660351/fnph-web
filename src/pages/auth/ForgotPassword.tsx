import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@/lib/api/endpoints/auth'
import { toApiError } from '@/lib/api/http'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { Alert } from '@/components/ui/Alert'
import { TextField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import type { Portal } from '@/lib/auth/roles'
import { AuthCard } from './AuthCard'

const BACK: Record<Portal, string> = { patient: '/patients', core: '/staff', centre: '/centres' }

export function ForgotPassword() {
  useDocumentTitle('Reset your password')
  const [params] = useSearchParams()
  const from = (params.get('from') as Portal) || 'core'
  const portal: Portal = from in BACK ? from : 'core'
  const [identifier, setIdentifier] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) return setError('Enter your username, email or EHR number.')
    setBusy(true)
    setError(null)
    try {
      await authApi.forgotPassword(identifier)
      setSent(true)
    } catch (err) {
      const apiError = toApiError(err)
      // The server answers the same way whether or not an account exists. Only a transport or rate-limit failure is shown.
      if (apiError.isNetworkError || apiError.status === 429 || apiError.status >= 500) setError(apiError.message)
      else setSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard portal={portal}>
      {sent ? (
        <>
          <h1 className="text-2xl font-extrabold">Check your email</h1>
          <p className="mt-2 text-sm text-muted">
            If an account matches what you entered and has a verified email address, a reset link is on its way. It works for 60 minutes. Check your spam folder too.
          </p>
          <p className="mt-3 text-sm text-muted">No email after a few minutes? Contact the helpdesk. Staff can also ask Central Administration for a reset.</p>
          <Link to={BACK[portal]} className="btn btn-secondary mt-6 w-full no-underline">Back to sign in</Link>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <h1 className="text-2xl font-extrabold">Reset your password</h1>
          <p className="mt-2 text-sm text-muted">Enter the username, email or EHR number you sign in with.</p>
          {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
          <TextField wrapperClassName="mt-5" label="Username, email or EHR number" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
          <button className="btn btn-primary mt-6 w-full" type="submit" disabled={busy}>
            {busy ? <Spinner label="Sending" inverted /> : 'Send reset link'}
          </button>
          <Link to={BACK[portal]} className="mt-4 block text-center text-sm font-bold">Back to sign in</Link>
        </form>
      )}
    </AuthCard>
  )
}
