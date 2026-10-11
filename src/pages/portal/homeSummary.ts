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

/** Clinic opening time used when the doctor set a follow-up date but no time. */
const DEFAULT_REVIEW_TIME = '09:00'

/**
 * The moment a follow-up falls due, in epoch ms. The hospital works in WAT
 * (UTC+1, no daylight saving), so the date and time are read as WAT.
 */
export function followUpTarget(due: FollowUpDue): number | null {
  if (!due.date) return null
  const t = due.followUp.preferredTime && /^\d{2}:\d{2}/.test(due.followUp.preferredTime)
    ? due.followUp.preferredTime.slice(0, 5)
    : DEFAULT_REVIEW_TIME
  const ms = Date.parse(`${due.date}T${t}:00+01:00`)
  return Number.isNaN(ms) ? null : ms
}

/** Days, hours, minutes and seconds left. All zero once the moment has passed. */
export function countdownParts(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}

/** Weekday, day and month of an instant in WAT, for the calendar leaf. */
export function watParts(ms: number): { weekday: string; day: string; month: string; time: string } {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: DISPLAY_TIME_ZONE, ...o }).format(new Date(ms))
  return {
    weekday: f({ weekday: 'short' }),
    day: f({ day: 'numeric' }),
    month: f({ month: 'short' }),
    time: f({ hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', ' ').toLowerCase(),
  }
}

export type NoticeTone = 'danger' | 'warning' | 'info'

export interface CareNotice {
  id: string
  tone: NoticeTone
  title: string
  body: string
  action?: { to: string; label: string }
}

const SOON_DAYS = 7
const BOOK = { to: '/portal/booking' }
const DOCS = { to: '/portal/documents', label: 'Open documents' }

/**
 * What the patient should act on, most urgent first. Worded as a clinic letter
 * would: what is happening, by when, and the one thing to do about it.
 */
export function careNotices(input: {
  today: string
  due: FollowUpDue | null
  hasUpcomingAppointment: boolean
  awaitingConfirmation: string | null
  prescription: PrescriptionDetail | null
  investigation: InvestigationDetail | null
}): CareNotice[] {
  const out: CareNotice[] = []
  const { today, due, hasUpcomingAppointment } = input

  if (due && due.date && due.days != null && !hasUpcomingAppointment) {
    if (due.days < 0) {
      const n = Math.abs(due.days)
      out.push({
        id: 'follow-up-overdue',
        tone: 'danger',
        title: 'Your follow-up review is overdue',
        body: `Your doctor asked to review you ${due.estimated ? 'around' : 'on'} ${longDate(due.date)}, ${n} day${n === 1 ? '' : 's'} ago. Book a consultation so your treatment can be reviewed. Keep taking your medicines as prescribed until then.`,
        action: { to: BOOK.to, label: 'Book follow-up' },
      })
    } else if (due.days <= SOON_DAYS && !due.scheduled) {
      out.push({
        id: 'follow-up-soon',
        tone: 'warning',
        title: due.days === 0 ? 'Your follow-up review is due today' : `Your follow-up review is due in ${due.days} day${due.days === 1 ? '' : 's'}`,
        body: `No appointment is booked for it yet. Book a consultation for ${due.estimated ? 'around ' : ''}${longDate(due.date)} so the review is not missed.`,
        action: { to: BOOK.to, label: 'Book follow-up' },
      })
    }
  }

  const rx = input.prescription
  if (rx?.expiryDate && releaseState(rx.status) !== 'checking') {
    const left = daysBetween(today, rx.expiryDate)
    if (releaseState(rx.status) === 'expired' || left < 0) {
      out.push({
        id: 'rx-expired',
        tone: 'warning',
        title: 'Your prescription has expired',
        body: `It ended on ${longDate(rx.expiryDate)} and can no longer be dispensed. Do not stop or change your medicines on your own. Book a consultation so your doctor can review and renew it.`,
        action: { to: BOOK.to, label: 'Book a review' },
      })
    } else if (left <= SOON_DAYS) {
      out.push({
        id: 'rx-ending',
        tone: 'warning',
        title: left === 0 ? 'Your prescription ends today' : `Your prescription ends in ${left} day${left === 1 ? '' : 's'}`,
        body: `It is valid until ${longDate(rx.expiryDate)}. Book a review before then so your treatment is not interrupted.`,
        action: { to: BOOK.to, label: 'Book a review' },
      })
    }
  }

  const lab = input.investigation
  if (lab?.expiryDate && releaseState(lab.status) === 'ready') {
    const left = daysBetween(today, lab.expiryDate)
    if (left >= 0 && left <= SOON_DAYS) {
      out.push({
        id: 'lab-ending',
        tone: 'info',
        title: 'Take your lab request to the laboratory',
        body: `The request is valid until ${longDate(lab.expiryDate)}. After that date the laboratory cannot accept it.`,
        action: DOCS,
      })
    }
  }

  if (input.awaitingConfirmation) {
    out.push({
      id: 'awaiting-confirmation',
      tone: 'info',
      title: 'Your appointment is waiting for confirmation',
      body: `The hospital is reviewing your request for ${input.awaitingConfirmation}. You will be notified when it is confirmed or if the time has to change.`,
      action: { to: '/portal/appointments', label: 'View appointment' },
    })
  }

  const rank: Record<NoticeTone, number> = { danger: 0, warning: 1, info: 2 }
  return out.sort((a, b) => rank[a.tone] - rank[b.tone])
}

/** Long weekday date of an instant in WAT: "Sunday 11 October 2026". */
export function todayLine(now: number): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: DISPLAY_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(now))
}
