import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { centreApi, type RegisterPatientRequest } from './centreApi'

export default function RegisterPatient() {
  const navigate = useNavigate()

  const [form, setForm] = useState<RegisterPatientRequest>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    phoneNumber: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof RegisterPatientRequest>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value || undefined }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await centreApi.registerPatient(form)
      navigate('/centre/patients')
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'That patient was not registered.',
      )
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <h1>Register a patient</h1>
      <p>
        This record belongs to your centre. It is not an FNPH patient record and
        does not create one.
      </p>

      <label>
        Your own patient number (optional)
        <input
          onChange={(e) => set('centrePatientId', e.target.value)}
          maxLength={50}
        />
      </label>

      <label>
        First name
        <input
          onChange={(e) => set('firstName', e.target.value)}
          maxLength={100}
          required
        />
      </label>

      <label>
        Last name
        <input
          onChange={(e) => set('lastName', e.target.value)}
          maxLength={100}
          required
        />
      </label>

      <label>
        Middle name
        <input
          onChange={(e) => set('middleName', e.target.value)}
          maxLength={100}
        />
      </label>

      <label>
        Date of birth
        <input
          type="date"
          onChange={(e) => set('dateOfBirth', e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          required
        />
      </label>

      <label>
        Gender
        <input onChange={(e) => set('gender', e.target.value)} maxLength={20} />
      </label>

      <label>
        Phone number
        <input
          onChange={(e) => set('phoneNumber', e.target.value)}
          maxLength={20}
          required
        />
      </label>

      <label>
        Email
        <input
          type="email"
          onChange={(e) => set('email', e.target.value)}
          maxLength={100}
        />
      </label>

      <label>
        Address
        <textarea
          onChange={(e) => set('address', e.target.value)}
          maxLength={500}
          rows={2}
        />
      </label>

      <label>
        FNPH hospital number, if they have one (optional)
        <input
          onChange={(e) => set('fnphEhrNumber', e.target.value)}
          maxLength={50}
        />
      </label>

      {/*
        Not a link and not a lookup. The offline hospital record is not
        retrieved or joined, so this is a reference the clinician can quote. If
        the form implied it pulled history, the centre would write thinner
        referrals on the assumption FNPH already had the detail.
      */}
      <p>
        This does not retrieve their FNPH history. Put everything the clinician
        needs in the referral itself.
      </p>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={busy}>
        {busy ? 'Registering...' : 'Register'}
      </button>
    </form>
  )
}