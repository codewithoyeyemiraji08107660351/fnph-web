import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { enrolmentApi } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import type { EnrolmentLookup } from '@/lib/api/types'
import { formatCalendarDate, formatPhone, formatTime } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { AuthCard } from '@/pages/auth/AuthCard'
import { Alert } from '@/components/ui/Alert'
import {
  PasswordField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { PatientRecordBanner } from '@/features/patient/PatientRecordBanner'

type Step = 'lookup' | 'confirm' | 'done' | 'help' | 'helpSent'

function HelpForm({
  initialEhr,
  onSent,
  onBack,
}: {
  initialEhr: string
  onSent: () => void
  onBack: () => void
}) {
  const [form, setForm] = useState({
    ehrNumber: initialEhr,
    fullName: '',
    dateOfBirth: '',
    phoneNumber: '',
    email: '',
    preferredContact: 'SMS',
    supportingNote: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set =
    (k: keyof typeof form) =>
    (
      e: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()

    if (!form.ehrNumber.trim() || !form.fullName.trim()) {
      return setError('Enter your hospital number and full name.')
    }

    if (!form.phoneNumber.trim() && !form.email.trim()) {
      return setError(
        'Give a phone number or email so the hospital can reach you.',
      )
    }

    setBusy(true)
    setError(null)

    try {
      await enrolmentApi.help({
        ehrNumber: form.ehrNumber.trim(),
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
        phoneNumber: form.phoneNumber.trim() || undefined,
        email: form.email.trim() || undefined,
        preferredContact: form.preferredContact,
        supportingNote: form.supportingNote.trim() || undefined,
      })
      onSent()
    } catch (err) {
      const e = toApiError(err)

      // The request is accepted the same way whether or not the record exists.
      // Only a transport or validation problem is worth showing.
      if (e.isNetworkError || e.status === 400 || e.status === 429) {
        setError(e.message)
      } else {
        onSent()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <span className="kicker">Manual check</span>
      <h1 className="text-2xl font-extrabold">
        Ask the hospital to check your record
      </h1>
      <p className="mt-2 text-sm text-muted">
        If you registered recently or your details have changed, the online list
        may not match yet. Records staff check by hand and contact you.
      </p>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}

      <div className="mt-5 space-y-4">
        <TextField
          label="Hospital (EHR) number"
          value={form.ehrNumber}
          onChange={set('ehrNumber')}
          autoCapitalize="characters"
          required
        />
        <TextField
          label="Full name, as on your hospital card"
          value={form.fullName}
          onChange={set('fullName')}
          autoComplete="name"
          required
        />
        <TextField
          label="Date of birth (optional)"
          type="date"
          value={form.dateOfBirth}
          onChange={set('dateOfBirth')}
        />
        <TextField
          label="Phone number"
          type="tel"
          value={form.phoneNumber}
          onChange={set('phoneNumber')}
          autoComplete="tel"
        />
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChange={set('email')}
          autoComplete="email"
        />
        <SelectField
          label="How should we contact you?"
          value={form.preferredContact}
          onChange={set('preferredContact')}
        >
          <option value="SMS">Text message</option>
          <option value="CALL">Phone call</option>
          <option value="EMAIL">Email</option>
        </SelectField>
        <TextAreaField
          label="Anything that helps us find your record (optional)"
          rows={3}
          maxLength={500}
          value={form.supportingNote}
          onChange={set('supportingNote')}
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary mt-6 w-full"
        disabled={busy}
      >
        {busy ? <Spinner label="Sending" inverted /> : 'Send request'}
      </button>
      <button
        type="button"
        className="btn btn-quiet mt-2 w-full"
        onClick={onBack}
      >
        Back
      </button>
    </form>
  )
}

export function Enrol() {
  useDocumentTitle('Set up your patient account')

  const { emergencyNumber } = usePublicSettings()
  const [step, setStep] = useState<Step>('lookup')
  const [ehrNumber, setEhrNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [match, setMatch] = useState<EnrolmentLookup | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false)

  const lookup = async (e: FormEvent) => {
    e.preventDefault()

    if (!ehrNumber.trim()) {
      return setError('Enter the hospital number on your card.')
    }

    setBusy(true)
    setError(null)
    setAlreadyEnrolled(false)

    try {
      setMatch(
        await enrolmentApi.lookup({
          ehrNumber: ehrNumber.trim(),
          dateOfBirth,
        }),
      )
      setStep('confirm')
    } catch (err) {
      const apiError = toApiError(err)
      setError(apiError.message)
      setAlreadyEnrolled(
        /already has an account|already enrolled/i.test(apiError.message),
      )
    } finally {
      setBusy(false)
    }
  }

  const complete = async (e: FormEvent) => {
    e.preventDefault()
    if (!match) return

    if (password.length < 8) {
      return setError('Use at least 8 characters.')
    }

    if (password !== confirm) {
      return setError('The two passwords do not match.')
    }

    setBusy(true)
    setError(null)
    setAlreadyEnrolled(false)

    try {
      await enrolmentApi.complete({
        verificationPublicId: match.verificationPublicId,
        password,
      })
      setStep('done')
    } catch (err) {
      const apiError = toApiError(err)
      setError(apiError.message)
      setAlreadyEnrolled(
        /already has an account|already enrolled/i.test(apiError.message),
      )
    } finally {
      setBusy(false)
    }
  }

  if (step === 'lookup') {
    return (
      <>
        <div className="stage-header">
          <div>
            <span>Welcome</span>
            <strong>Begin with your FNPH record</strong>
          </div>
          <span className="step-pill">Patient journey</span>
        </div>

        <div className="landing-hero">
          <div>
            <span className="kicker">FNPH KADUNA TELEPSYCHIATRY</span>
            <h1>Follow-up care, from a calm place of your choosing.</h1>
            <p>
              Your health is our concern. Use your existing hospital EHR number to
              enrol, complete the safety and privacy checks, then request a secure
              consultation.
            </p>
            <div className="eligibility-badges">
              <span>✓ Existing patients only</span>
              <span>✓ Previously assessed in person</span>
              <span>✓ Non-emergency follow-up</span>
            </div>
          </div>
          <div className="hero-symbol" aria-hidden>
            <img src="/fnph-logo.png" alt="" />
            <span>A place for care, healing and renewed hope.</span>
          </div>
        </div>

        <div className="landing-grid">
          <form className="card lookup-card" onSubmit={lookup} noValidate>
            <span className="eyebrow">Step one · hospital record</span>
            <h2>Enter the EHR number on your card</h2>
            <p>
              We first match the number to a verified existing FNPH record. You
              cannot create a new hospital record through this service.
            </p>

            <label htmlFor="ehr-lookup">Existing FNPH EHR number</label>
            <div className="inline-form">
              <input
                id="ehr-lookup"
                inputMode="numeric"
                autoComplete="off"
                maxLength={50}
                value={ehrNumber}
                onChange={(e) => setEhrNumber(e.target.value)}
                required
              />
              <button className="button primary" type="submit" disabled={busy}>
                {busy ? 'Checking…' : 'Find my record →'}
              </button>
            </div>

            <div className="form-foot">
              <button
                className="text-button"
                type="button"
                onClick={() => setStep('help')}
              >
                My card number is not recognised
              </button>
            </div>

            {error && (
              <Alert tone="danger" className="mt-4">
                {error}
                {alreadyEnrolled && (
                  <span className="mt-2 block">
                    <Link className="font-bold underline" to="/patients">
                      Sign in to your account
                    </Link>{' '}
                    or{' '}
                    <Link
                      className="font-bold underline"
                      to="/forgot-password?from=patient"
                    >
                      reset your password
                    </Link>
                    .
                  </span>
                )}
              </Alert>
            )}
          </form>

          <div className="card guide-card">
            <div className="guide-visual">
              <span className="play-disc">▶</span>
              <small>Introduction video space</small>
            </div>
            <h2>See how telepsychiatry works</h2>
            <p>
              Learn about enrolment, booking, the private consultation room and
              follow-up care.
            </p>
            <a className="button outline" href="#patient-main">
              View patient journey
            </a>
          </div>
        </div>
      </>
    )
  }

  return (
    <AuthCard portal="patient">
      {step === 'helpSent' ? (
        <>
          <h1 className="text-2xl font-extrabold">Request received</h1>
          <p className="mt-2 text-sm text-muted">
            Records staff will check your details and contact you. No account is
            created until your record is confirmed.
          </p>
          <Link
            to="/patients"
            className="btn btn-secondary mt-6 w-full no-underline"
          >
            Back to patient services
          </Link>
        </>
      ) : step === 'help' ? (
        <HelpForm
          initialEhr={ehrNumber}
          onSent={() => setStep('helpSent')}
          onBack={() => setStep(match ? 'confirm' : 'lookup')}
        />
      ) : step === 'done' ? (
        <>
          <span className="grid size-12 place-items-center rounded-2xl bg-mint text-xl text-forest">
            <i aria-hidden className="bi bi-check2" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold">Your account is ready</h1>
          <p className="mt-2 text-sm text-muted">
            Sign in with your hospital number{' '}
            <strong className="text-ink">{ehrNumber.trim()}</strong> and the
            password you just chose.
          </p>
          <Link
            to="/patients"
            className="btn btn-primary mt-6 w-full no-underline"
          >
            Sign in
          </Link>
        </>
      ) : step === 'confirm' && match ? (
        <form onSubmit={complete} noValidate>
          <span className="kicker">Step 2 of 2</span>
          <h1 className="text-2xl font-extrabold">Create your password</h1>

          <div className="mt-4">
            <PatientRecordBanner
              ehrNumber={match.ehrNumber}
              fullName={match.fullName}
              dateOfBirth={match.dateOfBirthMasked}
              clinic={match.clinic}
              stage="Step 2 of 2"
            />
          </div>

          <p className="mt-4 text-sm">
            Choose the password you will use with your EHR number. This setup step
            expires at {formatTime(match.setupExpiresAt)} WAT.
          </p>
          <p className="mt-2 text-xs text-muted">
            The hospital record list is dated{' '}
            {formatCalendarDate(match.recordsAsAt)}. If the displayed details are
            not yours, start again or ask the hospital for help.
          </p>
          <p className="mt-2 text-sm text-muted">
            Wrong number?{' '}
            <button
              type="button"
              className="font-bold text-accent"
              onClick={() => {
                setMatch(null)
                setStep('lookup')
              }}
            >
              Start again
            </button>
          </p>

          {error && (
            <Alert tone="danger" className="mt-4">
              {error}
              {alreadyEnrolled && (
                <span className="mt-2 block">
                  <Link className="font-bold underline" to="/patients">
                    Sign in to your account
                  </Link>{' '}
                  or{' '}
                  <Link
                    className="font-bold underline"
                    to="/forgot-password?from=patient"
                  >
                    reset your password
                  </Link>
                  .
                </span>
              )}
            </Alert>
          )}

          <PasswordField
            wrapperClassName="mt-5"
            label="Choose a password"
            hint="At least 8 characters."
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <PasswordField
            wrapperClassName="mt-4"
            label="Confirm password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          <button
            type="submit"
            className="btn btn-primary mt-6 w-full"
            disabled={busy}
          >
            {busy ? (
              <Spinner label="Setting up" inverted />
            ) : (
              'Create my account'
            )}
          </button>
          <button
            type="button"
            className="btn btn-quiet mt-2 w-full"
            onClick={() => setStep('help')}
          >
            I need help with my record
          </button>
        </form>
      ) : (
        <form onSubmit={lookup} noValidate>
          <span className="kicker">Existing FNPH Kaduna patients</span>
          <h1 className="text-2xl font-extrabold">Set up your account</h1>
          <p className="mt-2 text-sm text-muted">
            Enter the hospital number printed on your card. When the record
            matches, you only need to create a password. New patients must be
            seen at the hospital first.
          </p>

          {error && (
            <Alert tone="danger" className="mt-4">
              {error}
              {alreadyEnrolled && (
                <span className="mt-2 block">
                  <Link className="font-bold underline" to="/patients">
                    Sign in to your account
                  </Link>{' '}
                  or{' '}
                  <Link
                    className="font-bold underline"
                    to="/forgot-password?from=patient"
                  >
                    reset your password
                  </Link>
                  .
                </span>
              )}
            </Alert>
          )}

          <TextField
            wrapperClassName="mt-5"
            label="Hospital (EHR) number"
            value={ehrNumber}
            onChange={(e) => setEhrNumber(e.target.value)}
            autoCapitalize="characters"
            spellCheck={false}
            required
          />
          <TextField
            wrapperClassName="mt-4"
            label="Date of birth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
            hint="A second identity check protects your hospital record."
          />

          <button
            type="submit"
            className="btn btn-primary mt-6 w-full"
            disabled={busy}
          >
            {busy ? <Spinner label="Checking" inverted /> : 'Continue'}
          </button>
          <button
            type="button"
            className="btn btn-quiet mt-2 w-full"
            onClick={() => setStep('help')}
          >
            My number is not recognised
          </button>

          <p className="mt-4 text-center text-sm">
            Already set up? <Link to="/patients">Sign in</Link>
          </p>
          <p className="mt-4 rounded-[12px] bg-blush px-3 py-2 text-center text-xs text-alarm-700">
            Not for emergencies. Call{' '}
            <a
              className="font-bold text-alarm-700"
              href={`tel:${emergencyNumber}`}
            >
              {formatPhone(emergencyNumber)}
            </a>
            .
          </p>
        </form>
      )}
    </AuthCard>
  )
}