import type { CentreVitalsReading } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'

function readings(v: CentreVitalsReading): Array<[string, string]> {
  const out: Array<[string, string]> = []
  if (v.systolic != null || v.diastolic != null) out.push(['Blood pressure', `${v.systolic ?? '?'}/${v.diastolic ?? '?'} mmHg`])
  if (v.heartRate != null) out.push(['Heart rate', `${v.heartRate} bpm`])
  if (v.respiratoryRate != null) out.push(['Respiratory rate', `${v.respiratoryRate} /min`])
  if (v.temperature != null) out.push(['Temperature', `${v.temperature} °C`])
  if (v.bloodOxygen != null) out.push(['SpO2', `${v.bloodOxygen}%`])
  if (v.bloodGlucose != null) out.push(['Blood glucose', `${v.bloodGlucose} mmol/L`])
  if (v.weightKg != null) out.push(['Weight', `${v.weightKg} kg`])
  if (v.heightCm != null) out.push(['Height', `${v.heightCm} cm`])
  if (v.bmi != null) out.push(['BMI', String(v.bmi)])
  return out
}

/** Readings taken at the centre, newest first. */
export function VitalsList({ vitals }: { vitals?: CentreVitalsReading[] }) {
  if (!vitals?.length) return <p className="text-sm text-muted">No vitals recorded by the centre.</p>
  return (
    <ul className="space-y-3">
      {vitals.map((v) => (
        <li key={v.publicId}>
          <p className="text-xs text-muted">{formatDateTime(v.measuredAt)}{v.recordedBy ? `, ${v.recordedBy}` : ''}</p>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {readings(v).map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {v.notes && <p className="mt-1 text-sm whitespace-pre-line">{v.notes}</p>}
        </li>
      ))}
    </ul>
  )
}
