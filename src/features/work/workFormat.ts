import type { WorkMetric, WorkRole } from '@/lib/api/types'
import { formatCount, formatHours } from '@/pages/hub/dashboard/dashboard'

export const WORK_ROLE_LABEL: Record<WorkRole, string> = {
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  PHARMACIST: 'Pharmacist',
  LABORATORY: 'Laboratory technician',
  HIM: 'HIM officer',
}

/** A metric value as a person reads it. Averages with nothing behind them say so. */
export function formatMetric(m: WorkMetric): string {
  if (m.value == null) return m.format === 'count' ? '0' : 'No data'
  switch (m.format) {
    case 'hours':
      return formatHours(m.value)
    case 'minutes':
      return m.value < 90 ? `${Math.round(m.value)} min` : formatHours(m.value / 60)
    case 'percent':
      return `${Math.round(m.value)}%`
    default:
      return formatCount(m.value)
  }
}

/** Where the signed-in person does each kind of work, for links out of their history. */
export const WORK_HOME: Record<WorkRole, string> = {
  DOCTOR: '/clinical',
  NURSE: '/queues/nursing',
  PHARMACIST: '/reviews/pharmacy',
  LABORATORY: '/reviews/laboratory',
  HIM: '/queues/him',
}
