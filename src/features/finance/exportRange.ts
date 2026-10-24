import { DISPLAY_TIME_ZONE } from '@/lib/format'

/**
 * Hospital-day ranges for the Finance Excel export.
 *
 * Every date here is YYYY-MM-DD in WAT, the same shape the export endpoint
 * takes. Limits mirror FinanceExportService so a bad range is caught before
 * the request, and the server still refuses it if this check is bypassed.
 */
export const MAX_EXPORT_DAYS = 366

const watFormat = new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE })

export const watDay = (now: number) => watFormat.format(new Date(now))

function parts(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return { y, m, d }
}

function iso(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10)
}

export function addDays(day: string, days: number) {
  const { y, m, d } = parts(day)
  return iso(y, m, d + days)
}

/** Inclusive day count. 1 Sep to 1 Sep is one day. */
export function daysBetween(from: string, to: string) {
  const a = parts(from)
  const b = parts(to)
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000) + 1
}

export type ExportPreset = { key: string; label: string; from: string; to: string }

export function exportPresets(today: string): ExportPreset[] {
  const { y, m } = parts(today)
  const monthStart = iso(y, m, 1)
  const lastMonthStart = iso(y, m - 1, 1)
  const lastMonthEnd = addDays(monthStart, -1)
  const quarterStartMonth = Math.floor((m - 1) / 3) * 3 + 1
  return [
    { key: 'this-month', label: 'This month', from: monthStart, to: today },
    { key: 'last-month', label: 'Last month', from: lastMonthStart, to: lastMonthEnd },
    { key: 'last-30', label: 'Last 30 days', from: addDays(today, -29), to: today },
    { key: 'quarter', label: 'This quarter', from: iso(y, quarterStartMonth, 1), to: today },
    { key: 'year', label: 'Year to date', from: iso(y, 1, 1), to: today },
  ]
}

/** Why the range cannot be exported, or null when it can. */
export function rangeProblem(from: string, to: string, today: string): string | null {
  if (!from || !to) return 'Choose a start date and an end date.'
  if (to < from) return 'The end date is before the start date.'
  if (from > today) return 'The start date is in the future. There is nothing to report yet.'
  if (daysBetween(from, to) > MAX_EXPORT_DAYS) return `One export covers at most ${MAX_EXPORT_DAYS} days. Choose a shorter period.`
  return null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "01 Sep 2026", the same form the workbook prints. */
export function formatDay(day: string) {
  const { y, m, d } = parts(day)
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`
}
