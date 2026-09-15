import { useState, type FormEvent } from 'react'
import { patientVitalsApi } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import type { VitalsInput } from '@/lib/api/types'
import { serverToWatInput, watInputToServer } from '@/lib/format'
import { Alert } from '@/components/ui/Alert'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'

type NumKey = 'systolic' | 'diastolic' | 'heartRate' | 'temperature' | 'weightKg' | 'heightCm' | 'bloodOxygen' | 'bloodGlucose'

const FIELDS: Array<{ key: NumKey; label: string; unit: string; step?: string; integer?: boolean; hint?: string }> = [
  { key: 'systolic', label: 'Blood pressure, top number', unit: 'mmHg', integer: true, hint: 'For 120/80, enter 120' },
  { key: 'diastolic', label: 'Blood pressure, bottom number', unit: 'mmHg', integer: true, hint: 'For 120/80, enter 80' },
  { key: 'heartRate', label: 'Pulse', unit: 'beats per minute', integer: true },
  { key: 'temperature', label: 'Temperature', unit: '°C', step: '0.1' },
  { key: 'weightKg', label: 'Weight', unit: 'kg', step: '0.1' },
  { key: 'heightCm', label: 'Height', unit: 'cm', step: '0.1' },
  { key: 'bloodOxygen', label: 'Oxygen level', unit: '%', integer: true, hint: 'Only if you have a pulse oximeter' },
  { key: 'bloodGlucose', label: 'Blood sugar', unit: 'mmol/L', step: '0.1', hint: 'Only if you checked it' },
]

const SOURCES = ['Home blood pressure machine', 'Pharmacy or chemist', 'Clinic or health centre', 'Someone measured it for me']

/**
  Patient-reported vitals. The nurse verifies them before the consultation,
  and nursing preparation cannot finish without them, so this is required.
*/
export function VitalsForm({ appointmentPublicId, onSaved }: { appointmentPublicId: string; onSaved: () => void }) {
  const [values, setValues] = useState<Record<NumKey, string>>({
    systolic: '', diastolic: '', heartRate: '', temperature: '', weightKg: '', heightCm: '', bloodOxygen: '', bloodGlucose: '',
  })
  const [measuredAt, setMeasuredAt] = useState(() => serverToWatInput(new Date()))
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body: VitalsInput = {}
    for (const f of FIELDS) {
      const raw = values[f.key].trim()
      if (!raw) continue
      const n = Number(raw)
      if (!Number.isFinite(n)) return setError(`${f.label} must be a number.`)
      body[f.key] = f.integer ? Math.round(n) : n
    }
    if (body.systolic === undefined || body.diastolic === undefined || body.heartRate === undefined) {
      return setError('Blood pressure and pulse are needed before the consultation.')
    }
    if (!source) return setError('Say how the readings were taken.')
    body.measuredAt = watInputToServer(measuredAt)
    body.measurementSource = source
    body.notes = notes.trim() || undefined
    setBusy(true)
    setError(null)
    try {
      await patientVitalsApi.submit(appointmentPublicId, body)
      onSaved()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={`${f.label} (${f.unit})`}
            hint={f.hint}
            type="number"
            inputMode={f.integer ? 'numeric' : 'decimal'}
            step={f.step ?? '1'}
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        ))}
        <TextField label="When were they taken? (WAT)" type="datetime-local" value={measuredAt} max={serverToWatInput(new Date())} onChange={(e) => setMeasuredAt(e.target.value)} />
        <SelectField label="How were they taken?" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Choose one</option>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </SelectField>
        <TextAreaField wrapperClassName="sm:col-span-2" label="Anything the nurse should know (optional)" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-primary mt-5" disabled={busy}>
        {busy ? <Spinner label="Saving" inverted /> : 'Save my readings'}
      </button>
    </form>
  )
}
