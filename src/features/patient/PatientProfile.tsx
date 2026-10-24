import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { patientRecordsApi } from '@/lib/api/endpoints/records'
import { api, toApiError } from '@/lib/api/http'
import { formatDateTime, initials } from '@/lib/format'
import { ErrorState } from '@/components/ui/Page'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { supportApi } from '@/lib/api/endpoints/support'

type Profile = { phone: string; email: string; location: string }
type Field = keyof Profile

const EMPTY: Profile = { phone: '', email: '', location: '' }

/* Mirrors PatientPortalProfileController.Profile, so mistakes are caught before saving. */
const FIELDS: Array<{
  key: Field
  label: string
  type: 'tel' | 'email' | 'text'
  max: number
  autoComplete: string
  hint: string
  wide?: boolean
}> = [
  { key: 'phone', label: 'Phone number', type: 'tel', max: 30, autoComplete: 'tel', hint: 'The number the care team should call. Include the country code, for example +234 803 000 0000.' },
  { key: 'email', label: 'Email address', type: 'email', max: 254, autoComplete: 'email', hint: 'For appointment updates and copies of letters.' },
  { key: 'location', label: 'Where you usually take consultations', type: 'text', max: 300, autoComplete: 'address-level2', hint: 'Town and area, for example Barnawa, Kaduna South.', wide: true },
]

function validate(p: Profile): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {}
  if (p.phone && !/^[+0-9 ()-]*$/.test(p.phone)) e.phone = 'Use digits, spaces, brackets, + or - only.'
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) e.email = 'Enter an email address in the form name@example.com.'
  return e
}

const same = (a: Profile, b: Profile) => a.phone === b.phone && a.email === b.email && a.location === b.location

export function PatientProfile() {
  const record = useQuery({ queryKey: ['my-record'], queryFn: patientRecordsApi.me })
  const profile = useQuery({ queryKey: ['portal-profile'], queryFn: () => api.get<Profile>('/patient/profile') })
  const [edited, setEdited] = useState<Profile | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const statusRef = useRef<HTMLParagraphElement>(null)

  // Announce the outcome and keep keyboard focus in the form after saving.
  useEffect(() => {
    if (message || error) statusRef.current?.focus()
  }, [message, error])

  if (record.isLoading || profile.isLoading) return <p>Loading your profile…</p>
  if (record.isError || profile.isError) {
    return (
      <ErrorState
        error={record.error ?? profile.error}
        onRetry={() => {
          void record.refetch()
          void profile.refetch()
        }}
      />
    )
  }

  const saved: Profile = { ...EMPTY, ...(profile.data ?? {}) }
  const form = edited ?? saved
  const dirty = !same(form, saved)
  const errors = validate(form)
  const invalid = Object.keys(errors).length > 0
  const r = record.data
  const name = `${r?.firstName ?? ''} ${r?.lastName ?? ''}`.trim()

  const change = (key: Field, value: string) => {
    setMessage('')
    setEdited({ ...form, [key]: value })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (invalid) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.put('/patient/profile', form)
      await profile.refetch()
      setEdited(null)
      setTouched(false)
      setMessage('Your contact details have been saved.')
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pd2 pp">
      <header className="pd2-head">
        <div>
          <h1>My profile</h1>
          <p className="pd2-lede">
            Your hospital identity is verified and kept as the hospital holds it. The contact
            details below are yours to keep up to date.
          </p>
        </div>
      </header>

      {/* ---------- Verified identity ---------- */}
      <section className="pp-identity" aria-labelledby="pp-identity-title">
        <div className="pp-person">
          <span className="pp-avatar" aria-hidden>{initials(name)}</span>
          <div>
            <h2 id="pp-identity-title">{name || 'Your hospital record'}</h2>
            <span className="pp-verified">
              <i className="bi bi-patch-check-fill" aria-hidden /> Verified FNPH Kaduna patient
            </span>
          </div>
        </div>

        <dl className="pp-facts">
          <div>
            <dt>EHR number</dt>
            <dd className="pp-mono">{r?.ehrNumber}</dd>
          </div>
          <div>
            <dt>Sign-in phone</dt>
            <dd>{r?.phoneNumber || 'Not on record'}</dd>
          </div>
          <div>
            <dt>Sign-in email</dt>
            <dd>{r?.email || 'Not on record'}</dd>
          </div>
          <div>
            <dt>Verified on</dt>
            <dd>{r?.eligibilityVerifiedAt ? formatDateTime(r.eligibilityVerifiedAt) : r?.activatedAt ? formatDateTime(r.activatedAt) : 'Not recorded'}</dd>
          </div>
        </dl>

        <p className="pp-lock">
          <i className="bi bi-lock" aria-hidden />
          <span>
            These details come from your hospital record and cannot be changed here. If anything is
            wrong, ask Health Records to correct it through the <Link to="/help">helpdesk</Link>.
          </span>
        </p>
      </section>

      {/* ---------- Editable contact details ---------- */}
      <form className="pp-form" onSubmit={submit} noValidate aria-labelledby="pp-form-title">
        <div className="pp-form-head">
          <h2 id="pp-form-title" className="pd2-h2">Contact details for your care team</h2>
          <p>
            Saved to this portal only. They do not change your hospital record or the phone and
            email you use to sign in.
          </p>
        </div>

        {message && (
          <p ref={statusRef} tabIndex={-1} className="pd2-notice is-success pp-status" role="status">
            <i className="bi bi-check-circle-fill" aria-hidden />
            <span className="pd2-notice-title">{message}</span>
          </p>
        )}
        {error && (
          <p ref={statusRef} tabIndex={-1} className="pd2-notice is-danger pp-status" role="alert">
            <i className="bi bi-exclamation-octagon-fill" aria-hidden />
            <span className="pd2-notice-title">{error}</span>
          </p>
        )}

        <div className="pp-fields">
          {FIELDS.map((f) => {
            const err = touched || form[f.key] ? errors[f.key] : undefined
            const id = `pp-${f.key}`
            return (
              <div key={f.key} className={`pp-field${f.wide ? ' is-wide' : ''}${err ? ' has-error' : ''}`}>
                <label htmlFor={id}>{f.label}</label>
                <input
                  id={id}
                  type={f.type}
                  inputMode={f.type === 'tel' ? 'tel' : undefined}
                  autoComplete={f.autoComplete}
                  maxLength={f.max}
                  value={form[f.key] ?? ''}
                  onChange={(e) => change(f.key, e.target.value)}
                  aria-invalid={!!err}
                  aria-describedby={`${id}-hint`}
                />
                <span id={`${id}-hint`} className={err ? 'pp-error' : 'pp-hint'}>
                  {err ?? f.hint}
                </span>
              </div>
            )
          })}
        </div>

        <div className="pp-actions">
          <button type="submit" className="pd2-btn pd2-btn-primary" disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          {dirty && !busy && (
            <button
              type="button"
              className="pd2-btn pd2-btn-quiet"
              onClick={() => {
                setEdited(null)
                setTouched(false)
                setError('')
              }}
            >
              Discard changes
            </button>
          )}
          {!dirty && !message && <span className="pp-saved">All changes saved</span>}
        </div>
      </form>

      <CloseAccount ehrNumber={r?.ehrNumber ?? ''} />

      {/* ---------- Security ---------- */}
      <Link to="/account" className="pp-security">
        <i className="bi bi-shield-lock" aria-hidden />
        <span>
          <b>Password and sign-in security</b>
          <small>Change your password and see where you are signed in.</small>
        </span>
        <i className="bi bi-chevron-right" aria-hidden />
      </Link>
    </div>
  )
}

/**
  Asking to close the online account. Google Play requires it in the app.
  It raises a helpdesk request rather than closing anything at once: the
  helpdesk confirms it is the patient, then deactivates the account. The
  medical record stays, as the hospital must keep it.
*/
function CloseAccount({ ehrNumber }: { ehrNumber: string }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const send = async () => {
    setBusy(true)
    setError('')
    try {
      await supportApi.raise({
        category: 'ACCESS_AND_SIGN_IN',
        subject: 'Close my online account',
        body: `The patient asked to close their online telepsychiatry account${ehrNumber ? ` (EHR ${ehrNumber})` : ''}. `
          + 'Confirm with them, then deactivate the account. The medical record is kept.'
          + (reason.trim() ? `\n\nReason given: ${reason.trim()}` : ''),
      })
      setOpen(false)
      setSent(true)
      toast('Request sent. The helpdesk will contact you to confirm.')
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="pp-form" aria-labelledby="pp-close-title">
      <div className="pp-form-head">
        <h2 id="pp-close-title" className="pd2-h2">Close my online account</h2>
        <p>
          Stops online access to this service. Your hospital medical record is not deleted.{' '}
          <Link to="/account-deletion">What closing does</Link>
        </p>
      </div>
      <div className="pp-actions">
        {sent ? (
          <span className="pp-saved">Request sent. The helpdesk will contact you.</span>
        ) : (
          <button type="button" className="pd2-btn pd2-btn-quiet" onClick={() => setOpen(true)}>
            Ask to close my account
          </button>
        )}
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        title="Ask to close your online account?"
        description="The helpdesk will contact you to confirm before closing it. Your medical record stays with the hospital."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Keep my account</button>
            <button type="button" className="btn btn-primary" onClick={() => void send()} disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
          </>
        }
      >
        {error && <p className="mb-3 text-sm text-alarm">{error}</p>}
        <TextAreaField label="Anything you want to tell us (optional)" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>
    </section>
  )
}
