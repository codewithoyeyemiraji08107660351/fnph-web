import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  centreApi,
  type CentrePatient,
  type CreateReferralRequest,
} from './centreApi'

export default function CreateReferral() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [patients, setPatients] = useState<CentrePatient[]>([])
  const [form, setForm] = useState<CreateReferralRequest>({
    centrePatientPublicId: params.get('patient') ?? '',
    referralReason: '',
    urgency: 'ROUTINE',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    centreApi
      .patients()
      .then((p) => {
        if (!cancelled) setPatients(p)
      })
      .catch(() => {
        if (!cancelled) setPatients([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Write one field. Empty strings collapse to undefined so optional
   * fields drop out of the JSON body rather than sending "" to the server,
   * which the DTO treats as a value rather than an omission.
   */
  function set<K extends keyof CreateReferralRequest>(
    key: K,
    value: CreateReferralRequest[K] | '',
  ) {
    setForm((f) => ({ ...f, [key]: value === '' ? undefined : value }))
  }

  const reasonTooShort = form.referralReason.trim().length < 20

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const referral = await centreApi.createReferral(form)
      // Created as a draft. Consent and submission are the next screen,
      // because consent must be taken with the patient present.
      navigate(`/centre/referrals/${referral.publicId}/submit`)
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'That referral was not created.',
      )
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <h1>New referral</h1>

      <label>
        Patient
        <select
          value={form.centrePatientPublicId}
          onChange={(e) => set('centrePatientPublicId', e.target.value)}
          required
        >
          <option value="">Choose a patient</option>
          {patients.map((p) => (
            <option key={p.publicId} value={p.publicId}>
              {p.firstName} {p.lastName} · {p.centrePatientId}
            </option>
          ))}
        </select>
      </label>

      {/*
        The 20-character minimum is the server's, and the reason for it is
        worth telling the user: this text is the only clinical context the
        consulting clinician receives. The offline FNPH record is not
        retrieved, so a two-line referral produces a consultation starting
        from nothing.
      */}
      <label>
        Why are you referring them?
        <textarea
          value={form.referralReason}
          onChange={(e) => set('referralReason', e.target.value)}
          rows={5}
          minLength={20}
          maxLength={4000}
          required
          placeholder="Persistent low mood and poor sleep over four months, no improvement on the current medication."
        />
      </label>
      <p>
        The clinician does not see any FNPH record for this patient. Whatever
        you write here is what they have to work with.
      </p>
      {reasonTooShort && form.referralReason.length > 0 && (
        <p>At least 20 characters.</p>
      )}

      <label>
        Your assessment
        <textarea
          value={form.assessment ?? ''}
          onChange={(e) => set('assessment', e.target.value)}
          rows={3}
          maxLength={4000}
        />
      </label>

      <label>
        Current condition
        <textarea
          value={form.currentCondition ?? ''}
          onChange={(e) => set('currentCondition', e.target.value)}
          rows={3}
          maxLength={4000}
        />
      </label>

      <label>
        Medicines they are taking
        <textarea
          value={form.relevantMedicines ?? ''}
          onChange={(e) => set('relevantMedicines', e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="Amitriptyline 25mg nightly since June 2026"
        />
      </label>

      <label>
        Previous results
        <textarea
          value={form.previousResults ?? ''}
          onChange={(e) => set('previousResults', e.target.value)}
          rows={2}
          maxLength={4000}
        />
      </label>

      <label>
        Urgency
        <select
          value={form.urgency}
          onChange={(e) => set('urgency', e.target.value as 'ROUTINE' | 'SOON')}
        >
          <option value="ROUTINE">Routine</option>
          <option value="SOON">Soon</option>
        </select>
      </label>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={busy || reasonTooShort}>
        {busy ? 'Saving...' : 'Save as draft'}
      </button>
    </form>
  )
}