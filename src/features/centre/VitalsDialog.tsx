import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { centreApi } from '@/lib/api/endpoints/centre'
import { toApiError } from '@/lib/api/http'
import type { CentreVitalsInput } from '@/lib/api/types'
import { Alert } from '@/components/ui/Alert'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { VitalsList } from './VitalsList'

type Key = Exclude<keyof CentreVitalsInput, 'notes'>

const FIELDS: Array<{ key: Key; label: string; step?: string }> = [
  { key: 'systolic', label: 'Systolic (mmHg)' },
  { key: 'diastolic', label: 'Diastolic (mmHg)' },
  { key: 'heartRate', label: 'Heart rate (bpm)' },
  { key: 'respiratoryRate', label: 'Respiratory rate (/min)' },
  { key: 'temperature', label: 'Temperature (°C)', step: '0.1' },
  { key: 'bloodOxygen', label: 'SpO2 (%)' },
  { key: 'bloodGlucose', label: 'Blood glucose (mmol/L)', step: '0.1' },
  { key: 'weightKg', label: 'Weight (kg)', step: '0.1' },
  { key: 'heightCm', label: 'Height (cm)', step: '0.1' },
]

/**
 * Centre staff record the readings they took, so the FNPH doctor sees numbers
 * instead of a photograph. The server checks the ranges and computes BMI.
 */
export function VitalsDialog({ appointmentPublicId, patientName, onClose }: { appointmentPublicId: string; patientName: string; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [values, setValues] = useState<Partial<Record<Key, string>>>({})
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const history = useQuery({ queryKey: ['centre-vitals', appointmentPublicId], queryFn: () => centreApi.vitals(appointmentPublicId) })
  const anything = FIELDS.some((f) => (values[f.key] ?? '').trim() !== '')

  async function save() {
    setBusy(true)
    setError(null)
    const body: CentreVitalsInput = {}
    for (const f of FIELDS) {
      const raw = (values[f.key] ?? '').trim()
      if (raw !== '') body[f.key] = Number(raw)
    }
    if (notes.trim()) body.notes = notes.trim()
    try {
      await centreApi.recordVitals(appointmentPublicId, body)
      await qc.invalidateQueries({ queryKey: ['centre-vitals', appointmentPublicId] })
      toast('Vitals recorded. The FNPH doctor can see them.')
      onClose()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title={`Vitals for ${patientName}`}
      description="Enter what you measured. Leave the rest blank."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !anything}>{busy ? 'Saving' : 'Record vitals'}</button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <TextField
              key={f.key}
              label={f.label}
              type="number"
              inputMode="decimal"
              step={f.step ?? '1'}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          ))}
        </div>
        <TextAreaField label="Notes (optional)" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {(history.data?.length ?? 0) > 0 && (
          <div className="border-t border-line pt-3">
            <p className="mb-2 text-sm font-bold">Already recorded</p>
            <VitalsList vitals={history.data} />
          </div>
        )}
      </div>
    </Dialog>
  )
}
