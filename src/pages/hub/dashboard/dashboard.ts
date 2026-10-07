import type { ActivityGroup, HubStatsDay } from '@/lib/api/types'
import { DISPLAY_TIME_ZONE } from '@/lib/format'

/** Hospital-day arithmetic. Dates are YYYY-MM-DD in WAT, matching the API. */
const watFormat = new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE })

export const watToday = () => watFormat.format(new Date())

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

export type PeriodKey = 'today' | '7d' | '30d' | '90d'

export const PERIODS: Array<{ key: PeriodKey; label: string; days: number }> = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
]

export interface Window {
  from: string
  to: string
}

export function periodWindow(key: PeriodKey): Window {
  const to = watToday()
  const days = PERIODS.find((p) => p.key === key)?.days ?? 30
  return { from: addDays(to, -(days - 1)), to }
}

/**
 * The board shows the period plus the next two weeks, so upcoming work sits
 * beside recent work. The API caps it at 92 days, so a long period starts later.
 */
export function boardWindow(period: Window): Window {
  const to = addDays(watToday(), 14)
  const earliest = addDays(to, -91)
  return { from: period.from < earliest ? earliest : period.from, to }
}

/** 7 Oct */
const shortDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export const formatShortDay = (day: string) => shortDay.format(new Date(`${day}T00:00:00Z`))

/** Average hours as something a person reads: "45 min", "3.5 h", "2.1 days". */
export function formatHours(hours?: number | null): string {
  if (hours == null) return 'No data'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${hours.toFixed(1)} h`
  return `${(hours / 24).toFixed(1)} days`
}

export const formatCount = (value?: number | null) =>
  value == null ? '0' : new Intl.NumberFormat('en-GB').format(value)

export type DailyMeasure = keyof Omit<HubStatsDay, 'date'>

export const MEASURES: Array<{ key: DailyMeasure; label: string; noun: string }> = [
  { key: 'requests', label: 'Requests', noun: 'booking requests' },
  { key: 'approved', label: 'Approved', noun: 'approvals' },
  { key: 'rejected', label: 'Rejected', noun: 'rejections' },
  { key: 'completed', label: 'Completed', noun: 'completed sessions' },
  { key: 'released', label: 'Released', noun: 'bundles released' },
]

export const ACTIVITY_GROUPS: Array<{ key: ActivityGroup; label: string; icon: string }> = [
  { key: 'REQUESTED', label: 'Requests', icon: 'bi-inbox' },
  { key: 'APPROVED', label: 'Approved', icon: 'bi-check2-circle' },
  { key: 'REJECTED', label: 'Rejected', icon: 'bi-x-circle' },
  { key: 'CHANGED', label: 'Cancelled or moved', icon: 'bi-calendar-x' },
  { key: 'SESSION', label: 'Sessions', icon: 'bi-camera-video' },
  { key: 'TEAM', label: 'Team', icon: 'bi-people' },
  { key: 'REVIEW', label: 'Reviews', icon: 'bi-clipboard2-check' },
  { key: 'RELEASE', label: 'Releases', icon: 'bi-send-check' },
  { key: 'EDIT', label: 'Hub edits', icon: 'bi-pencil-square' },
]

export const GROUP_ICON = Object.fromEntries(ACTIVITY_GROUPS.map((g) => [g.key, g.icon])) as Record<ActivityGroup, string>

/** The rows to watch for: a decision against the patient, or a stop in the flow. */
export const GROUP_TONE: Partial<Record<ActivityGroup, string>> = {
  APPROVED: 'text-forest',
  REJECTED: 'text-alarm',
  CHANGED: 'text-gold-700',
}

export const ROLE_SHORT: Record<string, string> = {
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  PHARMACIST: 'Pharmacist',
  LABORATORY: 'Laboratory',
  HIM: 'HIM',
}