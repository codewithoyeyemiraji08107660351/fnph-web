import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { enrolmentApi } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import type { EnrolmentLookup } from '@/lib/api/types'
import { formatCalendarDate, formatPhone, formatTime } from '@/lib/format'
import { passwordProblems } from '@/lib/passwords'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { AuthCard } from '@/pages/auth/AuthCard'
import { Alert } from '@/components/ui/Alert'
import { PasswordField, SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'

type Step = 'lookup' | 'confirm' | 'done' | 'help' | 'helpSent'

function HelpForm({ initialEhr, onSent, onBack }: { initialEhr: string; onSent: () => void; onBack: () => void }) {
  const [form, setForm] = useState({ ehrNumber: initialEhr, fullName: '', dateOfBirth: '', phoneNumber: '', email: '', preferredContact: 'SMS', supportingNote: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.ehrNumber.trim() || !form.fullName.trim()) return setError('Enter your hospital number and full name.')
    if (!form.phoneNumber.trim() && !form.email.trim()) return setError('Give a phone number or email so the hospital can reach you.')
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
      if (e.isNetworkError || e.status === 400 || e.status === 429) setError(e.message)
      else onSent()
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate>
      <span className="kicker">Manual check</span>
      <h1 className="text-2xl font-extrabold">Ask the hospital to check your record</h1>
      <p className="mt-2 text-sm text-muted">If you registered recently or your details have changed, the online list may not match yet. Records staff check by hand and contact you.</p>
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      <div className="mt-5 space-y-4">
        <TextField label="Hospital (EHR) number" value={form.ehrNumber} onChange={set('ehrNumber')} autoCapitalize="characters" required />
        <TextField label="Full name, as on your hospital card" value={form.fullName} onChange={set('fullName')} autoComplete="name" required />
        <TextField label="Date of birth (optional)" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
        <TextField label="Phone number" type="tel" value={form.phoneNumber} onChange={set('phoneNumber')} autoComplete="tel" />
        <TextField label="Email" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
        <SelectField label="How should we contact you?" value={form.preferredContact} onChange={set('preferredContact')}>
          <option value="SMS">Text message</option>
          <option value="CALL">Phone call</option>
          <option value="EMAIL">Email</option>
        </SelectField>
        <TextAreaField label="Anything that helps us find your record (optional)" rows={3} maxLength={500} value={form.supportingNote} onChange={set('supportingNote')} />
      </div>
      <button type="submit" className="btn btn-primary mt-6 w-full" disabled={busy}>
        {busy ? <Spinner label="Sending" inverted /> : 'Send request'}
      </button>
      <button type="button" className="btn btn-quiet mt-2 w-full" onClick={onBack}>Back</button>
    </form>
  )
}

export function Enrol() {
  useDocumentTitle('Set up your patient account')
  const { emergencyNumber } = usePublicSettings()
  const [step, setStep] = useState<Step>('lookup')
  const [ehrNumber, setEhrNumber] = useState('')
  const [method, setMethod] = useState<'dob' | 'phone'>('dob')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [phoneLastFour, setPhoneLastFour] = useState('')
  const [match, setMatch] = useState<EnrolmentLookup | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = async (e: FormEvent) => {
    e.preventDefault()
    if (!ehrNumber.trim()) return setError('Enter the hospital number on your card.')
    if (method === 'dob' ? !dateOfBirth : !/^\d{4}$/.test(phoneLastFour)) {
      return setError(method === 'dob' ? 'Enter your date of birth.' : 'Enter the last four digits of your phone number.')
    }
    setBusy(true)
    setError(null)
    try {
      setMatch(
        await enrolmentApi.lookup({
          ehrNumber: ehrNumber.trim(),
          dateOfBirth: method === 'dob' ? dateOfBirth : undefined,
          phoneLastFour: method === 'phone' ? phoneLastFour : undefined,
        }),
      )
      setStep('confirm')
    } catch (err) {
      // The server gives one answer for every mismatch, so this page does too.
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  const complete = async (e: FormEvent) => {
    e.preventDefault()
    if (!match) return
    if (!/^\d{6}$/.test(code.trim())) return setError('The code is six digits.')
    const problem = passwordProblems(password, confirm, 12, [ehrNumber, ...match.fullName.split(' ')])
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      await enrolmentApi.complete({ verificationPublicId: match.verificationPublicId, code: code.trim(), password })
      setStep('done')
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard portal="patient">
      {step === 'helpSent' ? (
        <>
          <h1 className="text-2xl font-extrabold">Request received</h1>
          <p className="mt-2 text-sm text-muted">Records staff will check your details and contact you. No account is created until your record is confirmed.</p>
          <Link to="/patients" className="btn btn-secondary mt-6 w-full no-underline">Back to patient services</Link>
        </>
      ) : step === 'help' ? (
        <HelpForm initialEhr={ehrNumber} onSent={() => setStep('helpSent')} onBack={() => setStep(match ? 'confirm' : 'lookup')} />
      ) : step === 'done' ? (
        <>
          <span className="grid size-12 place-items-center rounded-2xl bg-mint text-xl text-forest"><i aria-hidden className="bi bi-check2" /></span>
          <h1 className="mt-4 text-2xl font-extrabold">Your account is ready</h1>
          <p className="mt-2 text-sm text-muted">Sign in with your hospital number <strong className="text-ink">{ehrNumber.trim()}</strong> and the password you just chose.</p>
          <Link to="/patients" className="btn btn-primary mt-6 w-full no-underline">Sign in</Link>
        </>
      ) : step === 'confirm' && match ? (
        <form onSubmit={complete} noValidate>
          <span className="kicker">Step 2 of 2</span>
          <h1 className="text-2xl font-extrabold">Check this is you</h1>
          <dl className="mt-4 rounded-[14px] bg-soft p-4 text-sm">
            <dt className="text-xs text-muted">Name on the hospital record</dt>
            <dd className="font-display text-lg font-extrabold">{match.fullName}</dd>
            <dd className="text-muted">Born {match.dateOfBirthMasked}. {match.clinic} clinic.</dd>
          </dl>
          <p className="mt-3 text-sm text-muted">
            Not you? <button type="button" className="font-bold text-accent" onClick={() => { setMatch(null); setStep('lookup') }}>Start again</button>
          </p>
          <p className="mt-4 text-sm">
            We sent a code to <strong>{match.phoneMasked}</strong>. It expires at {formatTime(match.codeExpiresAt)} WAT.
          </p>
          <p className="mt-2 text-xs text-muted">
            These details come from the hospital record list dated {formatCalendarDate(match.recordsAsAt)}. If your number changed since then, the code went to the old one; ask for a manual check below.
          </p>
          {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
          <TextField wrapperClassName="mt-5" label="Six-digit code from the text message" maxLength={6} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
          <PasswordField wrapperClassName="mt-4" label="Choose a password" hint="At least 12 characters. A short phrase is easy to remember." autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <PasswordField wrapperClassName="mt-4" label="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          <button type="submit" className="btn btn-primary mt-6 w-full" disabled={busy}>
            {busy ? <Spinner label="Setting up" inverted /> : 'Create my account'}
          </button>
          <button type="button" className="btn btn-quiet mt-2 w-full" onClick={() => setStep('help')}>The code did not arrive</button>
        </form>
      ) : (
        <form onSubmit={lookup} noValidate>
          <span className="kicker">Existing FNPH Kaduna patients</span>
          <h1 className="text-2xl font-extrabold">Set up your account</h1>
          <p className="mt-2 text-sm text-muted">You need the hospital number printed on your card. New patients must be seen at the hospital first.</p>
          {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
          <TextField wrapperClassName="mt-5" label="Hospital (EHR) number" value={ehrNumber} onChange={(e) => setEhrNumber(e.target.value)} autoCapitalize="characters" spellCheck={false} required />
          <fieldset className="mt-4">
            <legend className="field-label">Confirm one more detail</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['dob', 'phone'] as const).map((m) => (
                <label key={m} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[12px] border px-2 text-center text-sm font-bold ${method === m ? 'border-accent bg-accent-soft text-accent' : 'border-line'}`}>
                  <input type="radio" name="method" className="sr-only" checked={method === m} onChange={() => setMethod(m)} />
                  {m === 'dob' ? 'Date of birth' : 'Phone number'}
                </label>
              ))}
            </div>
          </fieldset>
          {method === 'dob' ? (
            <TextField wrapperClassName="mt-4" label="Date of birth, as the hospital recorded it" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
          ) : (
            <TextField wrapperClassName="mt-4" label="Last four digits of your phone number" inputMode="numeric" maxLength={4} value={phoneLastFour} onChange={(e) => setPhoneLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))} required />
          )}
          <button type="submit" className="btn btn-primary mt-6 w-full" disabled={busy}>
            {busy ? <Spinner label="Checking" inverted /> : 'Continue'}
          </button>
          <button type="button" className="btn btn-quiet mt-2 w-full" onClick={() => setStep('help')}>My details do not match</button>
          <p className="mt-4 text-center text-sm">
            Already set up? <Link to="/patients">Sign in</Link>
          </p>
          <p className="mt-4 rounded-[12px] bg-blush px-3 py-2 text-center text-xs text-alarm-700">
            Not for emergencies. Call <a className="font-bold text-alarm-700" href={`tel:${emergencyNumber}`}>{formatPhone(emergencyNumber)}</a>.
          </p>
        </form>
      )}
    </AuthCard>
  )
}
