import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { workQueueApi } from '@/lib/api/endpoints/clinical'
import { saveBlob, uploadsApi, type UploadRow } from '@/lib/api/endpoints/records'
import { toApiError } from '@/lib/api/http'
import type { VitalsInput } from '@/lib/api/types'
import { formatDateTime, parseServerTime, serverToWatInput, watInputToServer } from '@/lib/format'

import { Alert } from '@/components/ui/Alert'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { ImagePane } from '@/features/files/FilePreview'
import { isImageUpload } from '@/features/files/uploadimage'

type NumberKey = 'systolic' | 'diastolic' | 'heartRate' | 'temperature' | 'respiratoryRate' | 'bloodOxygen' | 'bloodGlucose' | 'weightKg' | 'heightCm'

const FIELDS: Array<{ key: NumberKey; label: string; required?: boolean; step?: string }> = [
  { key: 'systolic', label: 'Systolic (mmHg)', required: true },
  { key: 'diastolic', label: 'Diastolic (mmHg)', required: true },
  { key: 'heartRate', label: 'Pulse (beats/min)', required: true },
  { key: 'temperature', label: 'Temperature (°C)', required: true, step: '0.1' },
  { key: 'respiratoryRate', label: 'Respiratory rate (/min)' },
  { key: 'bloodOxygen', label: 'Oxygen saturation (%)' },
  { key: 'bloodGlucose', label: 'Blood glucose (mmol/L)', step: '0.1' },
  { key: 'weightKg', label: 'Weight (kg)', step: '0.1' },
  { key: 'heightCm', label: 'Height (cm)', step: '0.1' },
]

const USABLE = new Set(['VITALS_EVIDENCE', 'LABORATORY_RESULT'])
const blocked = (u: UploadRow) => u.scanStatus === 'QUARANTINED' || u.scanStatus === 'REJECTED'

/**
 * For a patient who sent a photo or PDF of their readings instead of typing
 * them. The file on one side, the readings form on the other, so the nurse
 * reads and types without switching windows.
 */
export function TranscribeVitalsDialog({
  appointmentPublicId,
  reference,
  patientName,
  onClose,
  onDone,
}: {
  appointmentPublicId: string
  reference: string
  patientName: string
  onClose: () => void
  onDone: () => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const files = useQuery({
    queryKey: ['attached', appointmentPublicId],
    queryFn: () => uploadsApi.forReference(appointmentPublicId),
  })
  const usable = useMemo(
    () => (files.data ?? []).filter((u) => USABLE.has(u.category) && !blocked(u))
      // Vitals evidence first: that is where the readings should be.
      .sort((a, b) => Number(b.category === 'VITALS_EVIDENCE') - Number(a.category === 'VITALS_EVIDENCE')),
    [files.data],
  )

  const [activeId, setActiveId] = useState<string | null>(null)
  const [used, setUsed] = useState<Set<string> | null>(null)
  const [values, setValues] = useState<Partial<Record<NumberKey, string>>>({})
  const [measuredAt, setMeasuredAt] = useState<string | null>(null)
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Defaults derived from the files once they load, until the nurse changes them.
  const active = usable.find((u) => u.publicId === activeId) ?? usable[0]
  const sources = used ?? new Set(active ? [active.publicId] : [])
  const when = measuredAt ?? (active ? serverToWatInput(parseServerTime(active.uploadedAt) ?? new Date()) : '')

  const missing = FIELDS.filter((f) => f.required && !values[f.key]?.trim())
  const canSave = !busy && usable.length > 0 && sources.size > 0 && missing.length === 0 && !!when

  const toggleSource = (id: string) => {
    const next = new Set(sources)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setUsed(next)
  }

  async function save() {
    setBusy(true)
    setError(null)
    const readings: VitalsInput = {
      measuredAt: watInputToServer(when),
      measurementSource: source.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    for (const f of FIELDS) {
      const raw = values[f.key]?.trim()
      if (raw) readings[f.key] = Number(raw)
    }
    try {
      await workQueueApi.transcribeVitals(appointmentPublicId, readings, [...sources])
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['vitals', appointmentPublicId] }),
        qc.invalidateQueries({ queryKey: ['work-queue'] }),
      ])
      toast('Readings entered and verified.')
      onDone()
    } catch (e) {
      setError(toApiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      size="xl"
      title="Enter readings from the patient's file"
      description={<>{patientName}, {reference}. The readings are saved as patient-reported and verified by you. The file stays attached for the doctor to compare.</>}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!canSave}>
            {busy ? 'Saving' : 'Save readings'}
          </button>
        </>
      }
    >
      {files.isLoading && <Spinner label="Loading the patient's files" />}
      {files.isError && <Alert tone="danger">{toApiError(files.error).message}</Alert>}
      {files.isSuccess && usable.length === 0 && (
        <Alert tone="warning">
          The patient has not attached a readings file to this appointment. Raise an issue so the Hub Coordinator can contact them.
        </Alert>
      )}

      {usable.length > 0 && active && (
        <div className="grid gap-5 *:min-w-0 md:grid-cols-[1.15fr_1fr]">
          <section aria-label="Patient's file">
            {usable.length > 1 && (
              <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Choose a file">
                {usable.map((u, i) => (
                  <button
                    key={u.publicId}
                    type="button"
                    aria-pressed={u.publicId === active.publicId}
                    onClick={() => setActiveId(u.publicId)}
                    className={`btn btn-sm ${u.publicId === active.publicId ? 'btn-secondary' : 'btn-quiet'}`}
                  >
                    File {i + 1}
                  </button>
                ))}
              </div>
            )}
            {isImageUpload(active) ? (
              <ImagePane key={active.publicId} row={active} tall />
            ) : (
              <div className="rounded-[14px] border border-line bg-canvas p-4 text-sm">
                <p className="font-bold">{active.originalFileName}</p>
                <p className="mt-1 text-muted">PDFs open outside the app. Save it, read the values, then enter them here.</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mt-3"
                  onClick={async () => {
                    try { const f = await uploadsApi.download(active.publicId); saveBlob(f.blob, f.filename) } catch (e) { toast(toApiError(e).message, 'error') }
                  }}
                >
                  <i aria-hidden className="bi bi-download" /> Save PDF
                </button>
              </div>
            )}
            <fieldset className="mt-3">
              <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Readings taken from</legend>
              <ul className="space-y-1">
                {usable.map((u, i) => (
                  <li key={u.publicId}>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" checked={sources.has(u.publicId)} onChange={() => toggleSource(u.publicId)} />
                      <span className="min-w-0">
                        <span className="font-semibold">{usable.length > 1 ? `File ${i + 1}: ` : ''}{u.originalFileName}</span>
                        <span className="block text-xs text-muted">Sent {formatDateTime(u.uploadedAt)}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          </section>

          <section aria-label="Readings" className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <TextField
                  key={f.key}
                  label={f.required ? f.label : `${f.label}, optional`}
                  type="number"
                  inputMode="decimal"
                  step={f.step ?? '1'}
                  required={f.required}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              ))}
            </div>
            <TextField
              label="When they were measured"
              type="datetime-local"
              required
              value={when}
              onChange={(e) => setMeasuredAt(e.target.value)}
              hint="As shown on the file. If it shows no time, this defaults to when the patient sent it."
            />
            <TextField
              label="Where they were measured, optional"
              maxLength={150}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Clinic, pharmacy or home device, if the file says"
            />
            <TextAreaField
              label="Note, optional"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pulse unclear on the photo; confirmed by phone."
            />
            {missing.length > 0 && (
              <p className="text-xs text-muted">Still needed: {missing.map((f) => f.label.replace(/ \(.*\)$/, '').toLowerCase()).join(', ')}.</p>
            )}
          </section>
        </div>
      )}
    </Dialog>
  )
}
