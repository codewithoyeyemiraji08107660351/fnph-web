import { useState } from 'react'
import { intakeApi, type IntakeDraft, type PatientIntake } from '@/lib/api/endpoints/patient'
import { uploadsApi } from '@/lib/api/endpoints/records'
import { toApiError } from '@/lib/api/http'
import type { VitalsInput } from '@/lib/api/types'

export function IntakeStep({ initial, onSaved }: { initial?: IntakeDraft | null; onSaved: (draft: IntakeDraft) => void }) {
  const [form, setForm] = useState<PatientIntake>(initial?.intake ?? { reason: '', context: '', mode: 'VIDEO', vitals: {}, evidenceIds: [], laboratoryIds: [] })
  const [clinic, setClinic] = useState('')
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
  return <><div className="screen-heading"><span className="eyebrow">Consultation request</span><h1>Tell the team what you need</h1><p>Provide the reason for follow-up and recent vital signs. You may add a laboratory result or supporting information when available.</p></div>
    <form className="card form-card" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { onSaved(await intakeApi.save({ ...form, context: [clinic && `Usual clinic: ${clinic}`, form.context].filter(Boolean).join('\n'), vitals: route === 'measured' ? form.vitals : null, evidenceIds: route === 'upload' ? form.evidenceIds : [] })) } catch (err) { setError(toApiError(err).message) } finally { setBusy(false) } }}>
      <div className="form-grid"><label className="span-all">Main reason for this consultation<textarea required maxLength={4000} rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Briefly explain your follow-up concern" /></label><label>Usual FNPH clinic (optional)<input value={clinic} onChange={e => setClinic(e.target.value)} placeholder="Clinic or unit, if known" /></label><label>When were your vital signs taken?<input type="datetime-local" required={route === 'measured'} value={form.vitals?.measuredAt ?? ''} onChange={e => setForm({ ...form, vitals: { ...form.vitals, measuredAt: e.target.value } })} /></label></div>
      <div className="section-divider"><span>Required recent vital signs</span><small>Enter measured values or choose the document route. Use accurate, recent measurements.</small></div>
      <div className="choice-segment" role="radiogroup" aria-label="Vital sign submission method"><label><input type="radio" name="vitals-route" checked={route === 'measured'} onChange={() => setRoute('measured')} /> Enter measured values</label><label><input type="radio" name="vitals-route" checked={route === 'upload'} onChange={() => setRoute('upload')} /> Attach vital-sign document</label></div>
      {route === 'measured' ? <div className="form-grid">{([['systolic','Systolic blood pressure (mmHg)'],['diastolic','Diastolic blood pressure (mmHg)'],['heartRate','Pulse (beats/min)'],['temperature','Temperature (°C)'],['bloodGlucose','Blood sugar (mmol/L, optional)'],['bloodOxygen','Oxygen saturation (%, optional)'],['weightKg','Weight (kg, optional)'],['heightCm','Height (cm, optional)']] as const).map(([key,label],i) => <label key={key}>{label}<input type="number" step="any" required={i < 4} value={form.vitals?.[key] ?? ''} onChange={e => number(key,e.target.value)} /></label>)}<label className="span-all">Measured by / location<input required maxLength={150} value={form.vitals?.measurementSource ?? ''} onChange={e => setForm({ ...form, vitals: { ...form.vitals, measurementSource: e.target.value } })} placeholder="Hospital, pharmacy, clinic or home device" /></label></div> : <div className="upload-panel"><label>Vital-sign image or PDF<input type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={uploading} onChange={e => void upload(e.target.files,'VITALS_EVIDENCE')} /></label><small>{form.evidenceIds.length ? `${form.evidenceIds.length} file(s) uploaded` : 'Attach a clear recent record of the measured readings.'}</small></div>}
      <div className="notice amber"><b>Please check your measurements.</b><span>The clinician may use what you provide during consultation and treatment planning. Do not guess values; arrange a recent measurement if you do not have one.</span></div>
      <div className="section-divider"><span>Optional supporting information</span><small>Relevant laboratory results and additional context can help the team prepare.</small></div>
      <div className="form-grid"><label className="span-all">Laboratory result image or PDF (optional)<input type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={uploading} onChange={e => void upload(e.target.files,'LABORATORY_RESULT')} /><small>{form.laboratoryIds.length} file(s) uploaded</small></label><label className="span-all">Anything else the team should know? (optional)<textarea maxLength={4000} rows={3} value={form.context} onChange={e => setForm({ ...form, context: e.target.value })} placeholder="Current medicines, accessibility or connectivity needs" /></label></div>
      {error && <p className="form-error" role="alert">{error}</p>}<div className="actions"><button className="button primary" disabled={busy || uploading}>{uploading ? 'Uploading…' : busy ? 'Saving…' : 'Continue to payment'}</button></div>
    </form></>
}
