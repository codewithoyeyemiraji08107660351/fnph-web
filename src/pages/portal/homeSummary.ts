import type { InvestigationDetail, PrescriptionDetail } from '@/lib/api/types'
import type { MyFollowUp } from '@/lib/api/endpoints/records'
import { DISPLAY_TIME_ZONE } from '@/lib/format'

/*
  Plain-language helpers for the patient home page. Kept out of the component
  file so the page stays a component-only module.
*/

const DAY_MS = 86_400_000

/** Today's hospital date (WAT) as YYYY-MM-DD. */
export function hospitalToday(now: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE }).format(new Date(now))
}

/** Whole days from one YYYY-MM-DD to another. Negative when `to` has passed. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
  return Math.round((b - a) / DAY_MS)
}

function addDays(date: string, days: number): string {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) + days * DAY_MS)
  return d.toISOString().slice(0, 10)
}

/** "Tuesday, 14 October 2026" for a YYYY-MM-DD hospital date. */
export function longDate(date: string): string {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), 12))
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

/** "14 Oct 2026" for a YYYY-MM-DD date. Anything else is returned as given. */
export function shortDate(date?: string | null): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return date ?? ''
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), 12))
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d)
}

const WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}

/** "6 weeks", "two months", "10 days" as days. Null when it cannot be read. */
export function intervalDays(text?: string | null): number | null {
  if (!text || text === 'null') return null
  const m = text.toLowerCase().match(/(\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(day|week|month)/)
  if (!m) return null
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : WORDS[m[1]]
  if (!n) return null
  return m[2] === 'day' ? n : m[2] === 'week' ? n * 7 : n * 30
}

export interface FollowUpDue {
  followUp: MyFollowUp
  /** YYYY-MM-DD, or null when the doctor gave no date or period. */
  date: string | null
  /** Days from today. Negative when overdue. */
  days: number | null
  /** True when the date was worked out from the review period, not set by the hospital. */
  estimated: boolean
  scheduled: boolean
}

/**
 * The follow-up that matters now: a scheduled one first (soonest), otherwise
 * the newest recommendation still open.
 */
export function pickFollowUp(rows: MyFollowUp[] | undefined, today: string): FollowUpDue | null {
  if (!rows?.length) return null
  const open = rows.filter((f) => !f.status || f.status === 'RECOMMENDED' || f.status === 'SCHEDULED')
  if (!open.length) return null

  const scheduled = open
    .filter((f) => f.status === 'SCHEDULED' && f.scheduledDate && f.scheduledDate >= today)
    .sort((a, b) => (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? ''))[0]
  if (scheduled?.scheduledDate) {
    return { followUp: scheduled, date: scheduled.scheduledDate, days: daysBetween(today, scheduled.scheduledDate), estimated: false, scheduled: true }
  }

  const f = [...open].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const fixed = f.scheduledDate || f.preferredDate
  if (fixed) {
    return { followUp: f, date: fixed, days: daysBetween(today, fixed), estimated: false, scheduled: f.status === 'SCHEDULED' }
  }
  const span = intervalDays(f.reviewInterval) ?? intervalDays(f.expectedTimeframe)
  if (span != null && f.createdAt) {
    const date = addDays(f.createdAt.slice(0, 10), span)
    return { followUp: f, date, days: daysBetween(today, date), estimated: true, scheduled: false }
  }
  return { followUp: f, date: null, days: null, estimated: false, scheduled: false }
}

/** What a patient may be told about a prescription or lab request. */
export type ReleaseState = 'ready' | 'expired' | 'checking'

const SHOWN = ['RELEASED', 'EXPIRED', 'PENDING_REVIEW', 'REVIEWED']

/** The newest one the patient should hear about. Drafts and withdrawn ones are skipped. */
export function latestShown<T extends PrescriptionDetail | InvestigationDetail>(rows: T[] | undefined): T | null {
  return rows?.find((r) => SHOWN.includes(r.status)) ?? null
}

export function releaseState(status: string): ReleaseState {
  if (status === 'RELEASED') return 'ready'
  if (status === 'EXPIRED') return 'expired'
  return 'checking'
}

/** "in 2 days, 4 hours" / "in 3 hours, 12 minutes" / "in 8 minutes, 5 seconds". */
export function startsIn(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  if (d > 0) return `in ${part(d, 'day')}, ${part(h, 'hour')}`
  if (h > 0) return `in ${part(h, 'hour')}, ${part(m, 'minute')}`
  return `in ${part(m, 'minute')}, ${part(sec, 'second')}`
}

export function greeting(now: number): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: DISPLAY_TIME_ZONE }).format(new Date(now)),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
