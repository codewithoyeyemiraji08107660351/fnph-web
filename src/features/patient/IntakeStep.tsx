import { useState } from 'react'
import { intakeApi, type IntakeDraft, type PatientIntake } from '@/lib/api/endpoints/patient'
import { uploadsApi } from '@/lib/api/endpoints/records'
import { toApiError } from '@/lib/api/http'
import type { VitalsInput } from '@/lib/api/types'

export function IntakeStep({ initial, onSaved }: { initial?: IntakeDraft | null; onSaved: (draft: IntakeDraft) => void }) {
  const [form, setForm] = useState<PatientIntake>(initial?.intake ?? { reason: '', context: '', mode: 'VIDEO', vitals: {}, evidenceIds: [], laboratoryIds: [] })
  const [route, setRoute] = useState(form.vitals ? 'measured' : 'upload')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const number = (key: keyof VitalsInput, value: string) => setForm(f => ({ ...f, vitals: { ...f.vitals, [key]: value === '' ? undefined : Number(value) } }))
  const upload = async (files: FileList | null, category: 'VITALS_EVIDENCE' | 'LABORATORY_RESULT') => {
    if (!files?.length) return
    setUploading(true); setError('')
    try {
      for (const file of Array.from(files)) {
        const saved = await uploadsApi.upload(file, category)
        const key = category === 'VITALS_EVIDENCE' ? 'evidenceIds' : 'laboratoryIds'
        setForm(f => ({ ...f, [key]: [...f[key], saved.publicId] }))
      }
    } catch (err) { setError(toApiError(err).message) } finally { setUploading(false) }
  }
  return <><div className="screen-heading"><span className="eyebrow">Consultation request</span><h1>Provide recent information</h1><p>Describe the follow-up you need. Enter measured readings or upload a vital-sign document; do not guess your readings.</p></div>
    <form className="card journey-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { onSaved(await intakeApi.save({ ...form, vitals: route === 'measured' ? form.vitals : null, evidenceIds: route === 'upload' ? form.evidenceIds : [] })) } catch (err) { setError(toApiError(err).message) } finally { setBusy(false) } }}>
      <label>Reason for consultation<textarea required maxLength={4000} rows={4} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Tell us about your symptoms, medicines or follow-up needs" /></label>
      <fieldset><legend>Recent vital signs</legend><label><input type="radio" name="vitals-route" checked={route === 'measured'} onChange={() => setRoute('measured')} /> Enter measured readings</label><label><input type="radio" name="vitals-route" checked={route === 'upload'} onChange={() => setRoute('upload')} /> Upload vital-sign evidence</label></fieldset>
      {route === 'measured' ? <div className="grid gap-4 sm:grid-cols-2">{([['systolic','Systolic BP (mmHg)'],['diastolic','Diastolic BP (mmHg)'],['heartRate','Pulse (bpm)'],['temperature','Temperature (°C)'],['weightKg','Weight (kg, optional)'],['heightCm','Height (cm, optional)'],['bloodOxygen','Oxygen saturation (%, optional)'],['bloodGlucose','Blood glucose (mmol/L, optional)']] as const).map(([key,label],i) => <label key={key}>{label}<input type="number" step="any" required={i < 4} value={form.vitals?.[key] ?? ''} onChange={e => number(key,e.target.value)} /></label>)}
        <label>Measurement date and time (WAT)<input type="datetime-local" required value={form.vitals?.measuredAt ?? ''} onChange={e => setForm({ ...form, vitals: { ...form.vitals, measuredAt: e.target.value } })} /></label><label>Measured by / location<input required maxLength={150} value={form.vitals?.measurementSource ?? ''} onChange={e => setForm({ ...form, vitals: { ...form.vitals, measurementSource: e.target.value } })} /></label></div> : <label>Vital-sign document (PDF or image)<input type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={uploading} onChange={e => void upload(e.target.files,'VITALS_EVIDENCE')} /><small>{form.evidenceIds.length} file(s) uploaded</small></label>}
      <label>Laboratory results (optional)<input type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={uploading} onChange={e => void upload(e.target.files,'LABORATORY_RESULT')} /><small>{form.laboratoryIds.length} file(s) uploaded</small></label>
      <label>Additional context (optional)<textarea maxLength={4000} rows={3} value={form.context} onChange={e => setForm({ ...form, context: e.target.value })} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy || uploading}>{uploading ? 'Uploading…' : busy ? 'Saving…' : 'Save and continue to payment'}</button>
    </form></>
}
