import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { authApi } from '@/lib/api/endpoints/auth'
import { toApiError } from '@/lib/api/http'
import type { LoginResponse, MfaEnrolmentResponse, Principal } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { safeDashboardRoute, roleName, type Portal } from '@/lib/auth/roles'
import { Alert } from '@/components/ui/Alert'
import { PasswordField, TextField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useNow } from '@/lib/hooks/useNow'

type Step =
  | { kind: 'credentials' }
  | { kind: 'mfa'; token: string; expiresAt: number }
  | { kind: 'enrol'; token: string; expiresAt: number; enrolment?: MfaEnrolmentResponse }
  | { kind: 'recovery'; codes: string[]; principal: Principal }

const COPY: Record<Portal, { title: string; userLabel: string; userHint: string; autoComplete: string; inputMode?: 'numeric' }> = {
  patient: {
    title: 'Sign in to your care',
    userLabel: 'EHR number',
    userHint: 'The number on your FNPH Kaduna hospital card.',
    autoComplete: 'username',
    inputMode: 'numeric',
  },
  core: {
    title: 'Access your workspace',
    userLabel: 'Username or email',
    userHint: 'You are taken straight to the workspace for your role.',
    autoComplete: 'username',
  },
  centre: {
    title: 'Centre sign in',
    userLabel: 'Centre username or email',
    userHint: 'Issued by FNPH Central Administration for your centre.',
    autoComplete: 'username',
  },
}

function Countdown({ expiresAt, onExpire }: { expiresAt: number; onExpire: () => void }) {
  const now = useNow(1000)
  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  const fired = useRef(false)
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true
      onExpire()
    }
  }, [left, onExpire])
  return (
    <span className="tabular-nums">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </span>
  )
}

export function SignInPanel({ portal }: { portal: Portal }) {
  const { status, principal, completeSignIn, endedReason, clearEndedReason } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const copy = COPY[portal]

  const [step, setStep] = useState<Step>({ kind: 'credentials' })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(endedReason ?? (location.state as { notice?: string } | null)?.notice ?? null)
  const [savedCodes, setSavedCodes] = useState(false)

  useEffect(() => {
    if (endedReason) clearEndedReason()
  }, [endedReason, clearEndedReason])

  const finish = (p: Principal) => {
    if (p.mustChangePassword) {
      navigate('/account/password', { replace: true })
      return
    }
    const home = safeDashboardRoute(p.dashboardRoute)
    const from = (location.state as { from?: string } | null)?.from
    const target = from && home !== '/' && (from.startsWith(home) || from.startsWith('/account')) ? from : home
    navigate(target, { replace: true })
  }

  const handleResponse = async (res: LoginResponse) => {
    const mfaExpiry = Date.now() + (res.mfaExpiresInSeconds ?? 300) * 1000
    if (res.status === 'MFA_REQUIRED' && res.mfaToken) {
      setStep({ kind: 'mfa', token: res.mfaToken, expiresAt: mfaExpiry })
      setCode('')
      return
    }
    if (res.status === 'MFA_ENROLMENT_REQUIRED' && res.mfaToken) {
      const token = res.mfaToken
      setStep({ kind: 'enrol', token, expiresAt: mfaExpiry })
      setCode('')
      const enrolment = await authApi.beginMfaEnrolment(token)
      setStep({ kind: 'enrol', token, expiresAt: mfaExpiry, enrolment })
      return
    }
    if (res.status === 'AUTHENTICATED') {
      const p = await completeSignIn(res)
      if (res.recoveryCodes?.length) {
        setStep({ kind: 'recovery', codes: res.recoveryCodes, principal: p })
        return
      }
      finish(p)
    }
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  const onCredentials = (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError(`Enter your ${copy.userLabel.toLowerCase()} and password.`)
      return
    }
    void run(async () => {
      const res = await authApi.login(username, password)
      setPassword('')
      await handleResponse(res)
    })
  }

  const onMfa = (e: FormEvent) => {
    e.preventDefault()
    if (step.kind !== 'mfa') return
    void run(async () => handleResponse(await authApi.verifyMfa(step.token, code)))
  }

  const onActivate = (e: FormEvent) => {
    e.preventDefault()
    if (step.kind !== 'enrol') return
    void run(async () => handleResponse(await authApi.activateMfa(step.token, code)))
  }

  const expired = () => {
    setStep({ kind: 'credentials' })
    setCode('')
    setError('That sign-in attempt expired for your security. Enter your password again.')
  }

  const restart = () => {
    setStep({ kind: 'credentials' })
    setCode('')
    setError(null)
  }

  // Already signed in before this page opened.
  if (status === 'authenticated' && principal && step.kind === 'credentials' && !busy) {
    return (
      <div>
        <h2 className="text-2xl font-extrabold">You are signed in</h2>
        <p className="mt-2 text-sm text-muted">
          Signed in as <strong className="text-ink">{principal.displayName}</strong>, {roleName(principal.primaryRole)}.
        </p>
        <Link to={safeDashboardRoute(principal.dashboardRoute)} className="btn btn-primary mt-5 w-full no-underline">
          Open my workspace
        </Link>
      </div>
    )
  }

  if (status === 'loading') return <Spinner label="Checking your session" />

  if (step.kind === 'recovery') {
    const text = step.codes.join('\n')
    return (
      <div>
        <span className="kicker">Second factor ready</span>
        <h2 className="text-2xl font-extrabold">Save your recovery codes</h2>
        <p className="mt-2 text-sm text-muted">
          Each code signs you in once if your phone is lost. They are shown now and never again. Keep them somewhere other than the phone that holds
          your authenticator.
        </p>
        <ol className="mt-4 grid grid-cols-2 gap-2 rounded-[14px] border border-line bg-canvas p-4 font-mono text-sm">
          {step.codes.map((c) => (
            <li key={c} className="tabular-nums">
              {c}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(text)}>
            <i aria-hidden className="bi bi-clipboard" /> Copy
          </button>
          <a
            className="btn btn-secondary btn-sm no-underline"
            download="fnph-telepsychiatry-recovery-codes.txt"
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(`FNPH Kaduna Telepsychiatry recovery codes\nEach code works once.\n\n${text}\n`)}`}
          >
            <i aria-hidden className="bi bi-download" /> Download
          </a>
        </div>
        <label className="mt-5 flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={savedCodes} onChange={(e) => setSavedCodes(e.target.checked)} />
          <span>I have stored these codes safely, away from my authenticator phone.</span>
        </label>
        <button type="button" className="btn btn-primary mt-5 w-full" disabled={!savedCodes} onClick={() => finish(step.principal)}>
          Continue to my workspace
        </button>
      </div>
    )
  }

  if (step.kind === 'enrol') {
    return (
      <form onSubmit={onActivate} noValidate>
        <span className="kicker">One-time setup</span>
        <h2 className="text-2xl font-extrabold">Set up your authenticator</h2>
        <p className="mt-2 text-sm text-muted">
          Staff and centre accounts need a second factor. Scan the code with Google Authenticator, Microsoft Authenticator or any TOTP app, then enter
          the six digits it shows.
        </p>
        {!step.enrolment ? (
          <div className="my-8">
            <Spinner label="Preparing your setup code" />
          </div>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="mx-auto rounded-[14px] border border-line bg-white p-3">
              <QRCodeSVG value={step.enrolment.provisioningUri} size={168} level="M" title="Authenticator setup code" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted">Camera not working? Enter this key instead:</p>
              <p className="mt-1 font-mono text-sm break-all select-all">{step.enrolment.secret.replace(/(.{4})/g, '$1 ').trim()}</p>
            </div>
          </div>
        )}
        {error && <Alert tone="danger" className="mt-5">{error}</Alert>}
        <TextField
          wrapperClassName="mt-5"
          label="Six-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          disabled={!step.enrolment}
          required
          hint={
            <>
              This setup expires in <Countdown expiresAt={step.expiresAt} onExpire={expired} />.
            </>
          }
        />
        <button type="submit" className="btn btn-primary mt-5 w-full" disabled={busy || code.length !== 6 || !step.enrolment}>
          {busy ? <Spinner label="Confirming" inverted /> : 'Confirm and sign in'}
        </button>
        <button type="button" className="btn btn-quiet mt-2 w-full" onClick={restart}>
          Start again
        </button>
      </form>
    )
  }

  if (step.kind === 'mfa') {
    return (
      <form onSubmit={onMfa} noValidate>
        <span className="kicker">Second step</span>
        <h2 className="text-2xl font-extrabold">Enter your security code</h2>
        <p className="mt-2 text-sm text-muted">
          {useRecovery ? 'Enter one of the recovery codes you saved when you set up your authenticator. Each works once.' : 'Open your authenticator app and enter the six-digit code for FNPH Kaduna Telepsychiatry.'}
        </p>
        {error && <Alert tone="danger" className="mt-5">{error}</Alert>}
        {useRecovery ? (
          <TextField
            wrapperClassName="mt-5"
            label="Recovery code"
            value={code}
            onChange={(e) => setCode(e.target.value.trim().slice(0, 40))}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            required
          />
        ) : (
          <TextField
            wrapperClassName="mt-5"
            label="Six-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            required
            hint={
              <>
                This step expires in <Countdown expiresAt={step.expiresAt} onExpire={expired} />.
              </>
            }
          />
        )}
        <button type="submit" className="btn btn-primary mt-5 w-full" disabled={busy || (useRecovery ? !code.includes('-') : code.length !== 6)}>
          {busy ? <Spinner label="Verifying" inverted /> : 'Verify and sign in'}
        </button>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
          <button type="button" className="font-bold text-accent hover:underline" onClick={() => { setUseRecovery((v) => !v); setCode('') }}>
            {useRecovery ? 'Use my authenticator instead' : 'Lost your phone? Use a recovery code'}
          </button>
          <button type="button" className="text-muted hover:underline" onClick={restart}>
            Start again
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={onCredentials} noValidate>
      <h2 className="text-2xl font-extrabold">{copy.title}</h2>
      {notice && <Alert tone="info" className="mt-4">{notice}</Alert>}
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      <TextField
        wrapperClassName="mt-5"
        label={copy.userLabel}
        hint={copy.userHint}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete={copy.autoComplete}
        inputMode={copy.inputMode}
        autoCapitalize="none"
        spellCheck={false}
        required
      />
      <PasswordField
        wrapperClassName="mt-4"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <button type="submit" className="btn btn-primary mt-6 w-full" disabled={busy}>
        {busy ? <Spinner label="Signing in" inverted /> : 'Sign in securely'}
      </button>
      <p className="mt-4 text-center text-sm">
        <Link to={`/forgot-password?from=${portal}`} className="font-bold text-accent">
          Forgot your password?
        </Link>
      </p>
    </form>
  )
}
