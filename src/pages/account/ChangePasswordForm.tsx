import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/lib/api/endpoints/auth'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { safeDashboardRoute } from '@/lib/auth/roles'
import { Alert } from '@/components/ui/Alert'
import { PasswordField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { passwordProblems } from '@/lib/passwords'

/**
  The server signs out every other device and keeps this one. If this device
  was signed out too (an older backend), reloading the account fails with 401
  and the session-expired handler sends the person to sign in again.
*/
export function ChangePasswordForm() {
  const { principal, reloadPrincipal } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!current) return setError('Enter your current password.')
    const problem = passwordProblems(next, confirm, 12, [principal?.username ?? '', ...(principal?.displayName.split(' ') ?? [])])
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    const wasForced = Boolean(principal?.mustChangePassword)
    try {
      await authApi.changePassword(current, next)
    } catch (err) {
      setError(toApiError(err).message)
      setBusy(false)
      return
    }
    setCurrent('')
    setNext('')
    setConfirm('')
    try {
      await reloadPrincipal()
      toast('Password changed. Your other devices were signed out.')
      if (wasForced) navigate(safeDashboardRoute(principal?.dashboardRoute), { replace: true })
    } catch {
      // Handled by the session-expired listener.
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-md">
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <PasswordField label="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      <PasswordField wrapperClassName="mt-4" label="New password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" hint="At least 12 characters, not used here before." required />
      <PasswordField wrapperClassName="mt-4" label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      <p className="mt-4 text-xs text-muted">Changing your password signs you out on every other device.</p>
      <button type="submit" className="btn btn-primary mt-4" disabled={busy}>
        {busy ? <Spinner label="Changing" inverted /> : 'Change password'}
      </button>
    </form>
  )
}
