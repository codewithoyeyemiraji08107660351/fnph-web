import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { workQueueApi } from '@/lib/api/endpoints/clinical'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const ROWS: Array<[string, (v: import('@/lib/api/types').VitalsReading) => string | undefined]> = [
  ['Blood pressure', (v) => (v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic} mmHg` : undefined)],
  ['Pulse', (v) => (v.heartRate ? `${v.heartRate} bpm` : undefined)],
  ['Respiratory rate', (v) => (v.respiratoryRate ? `${v.respiratoryRate} /min` : undefined)],
  ['Temperature', (v) => (v.temperature ? `${v.temperature} °C` : undefined)],
  ['Oxygen', (v) => (v.bloodOxygen ? `${v.bloodOxygen}%` : undefined)],
  ['Weight', (v) => (v.weightKg ? `${v.weightKg} kg` : undefined)],
  ['Height', (v) => (v.heightCm ? `${v.heightCm} cm` : undefined)],
  ['BMI', (v) => (v.bmi ? v.bmi.toFixed(1) : undefined)],
  ['Blood glucose', (v) => (v.bloodGlucose ? `${v.bloodGlucose} mmol/L` : undefined)],
]

/** Readings for one appointment, newest first. Verification is a separate permission. */
export function VitalsList({ appointmentPublicId }: { appointmentPublicId: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()
  const vitals = useQuery({ queryKey: ['vitals', appointmentPublicId], queryFn: () => workQueueApi.vitals(appointmentPublicId) })
  const [busy, setBusy] = useState<string | null>(null)

  if (vitals.isLoading) return <Spinner label="Loading readings" />
  if (vitals.isError) return <p className="text-sm text-alarm">{toApiError(vitals.error).message}</p>
  if (!vitals.data?.length) return <p className="text-sm text-muted">The patient has not submitted readings yet.</p>

  return (
    <div className="space-y-3">
      {vitals.data.map((v) => (
        <div key={v.publicId} className="rounded-[14px] border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <strong>Taken {formatDateTime(v.measuredAt)}</strong>
              {v.measurementSource && <span className="text-muted">. {v.measurementSource}</span>}
            </p>
            {v.verifiedAt ? (
              <Badge tone="green">Verified by {v.verifiedBy}</Badge>
            ) : can('vitals.verify') ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy === v.publicId}
                onClick={async () => {
                  setBusy(v.publicId)
                  try {
                    await workQueueApi.verifyVitals(v.publicId)
                    toast('Readings verified.')
                    await qc.invalidateQueries({ queryKey: ['vitals', appointmentPublicId] })
                  } catch (err) {
                    toast(toApiError(err).message, 'error')
                  } finally {
                    setBusy(null)
                  }
                }}
              >
                {busy === v.publicId ? <Spinner /> : 'Mark verified'}
              </button>
            ) : (
              <Badge tone="gold">Patient reported</Badge>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {ROWS.map(([label, get]) => {
              const value = get(v)
              return value ? (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="font-bold">{value}</dd>
                </div>
              ) : null
            })}
          </dl>
          {v.notes && <p className="mt-3 text-sm text-muted">Patient note: {v.notes}</p>}
        </div>
      ))}
    </div>
  )
}
