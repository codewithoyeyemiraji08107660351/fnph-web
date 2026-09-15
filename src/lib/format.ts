/*
  All clinical and operational times are shown in West Africa Time, whatever
  the device clock says. A doctor travelling or a laptop set to UTC must still
  see the appointment at the hospital's time.

  The API sends UTC. Values with no offset are treated as UTC as well, which
  matches the backend once the JVM is pinned to UTC.
*/
export const DISPLAY_TIME_ZONE = 'Africa/Lagos'
const WAT_OFFSET = '+01:00'

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i

export function parseServerTime(value?: string | null): Date | null {
  if (!value) return null
  const normalised = HAS_OFFSET.test(value) ? value : `${value}Z`
  const date = new Date(normalised)
  return Number.isNaN(date.getTime()) ? null : date
}

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatDateTime(value?: string | null, fallback = 'Not recorded'): string {
  const date = parseServerTime(value)
  return date ? dateTimeFormat.format(date) : fallback
}

export function formatTime(value?: string | Date | null): string {
  const date = value instanceof Date ? value : parseServerTime(value)
  return date ? timeFormat.format(date) : ''
}

export function formatLongDate(date: Date = new Date()): string {
  return dateFormat.format(date)
}

/** Plain calendar dates such as "2026-10-14" carry no time and no zone. */
export function formatCalendarDate(value?: string | null): string {
  if (!value) return 'Not recorded'
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return value
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  )
}

const relative = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })

export function formatRelative(value?: string | null): string {
  const date = parseServerTime(value)
  if (!date) return 'Never'
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return relative.format(Math.round(seconds), 'second')
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 14) return relative.format(Math.round(seconds / 86400), 'day')
  return formatDateTime(value)
}

/**
  Converts a datetime-local input value, which the person entered in WAT, into
  the offset-free UTC string Spring binds to a LocalDateTime query parameter.
*/
export function watInputToServer(value?: string): string | undefined {
  if (!value) return undefined
  const withSeconds = value.length === 16 ? `${value}:00` : value
  const date = new Date(`${withSeconds}${WAT_OFFSET}`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 19)
}

/** A UTC instant rendered for a datetime-local input in WAT. */
export function serverToWatInput(date: Date): string {
  const wat = new Date(date.getTime() + 60 * 60 * 1000)
  return wat.toISOString().slice(0, 16)
}

export function formatNaira(value?: string | number | null): string {
  const amount = typeof value === 'string' ? Number(value) : value
  if (amount === undefined || amount === null || Number.isNaN(amount)) return ''
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount)
}

export function formatPhone(value?: string | null): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  return value
}

export function initials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

const ACRONYMS = new Set(['ehr', 'mfa', 'ngn', 'fnph', 'him', 'ict', 'ip', 'id', 'url', 'sms', 'lga', 'otp', 'qr'])

export function humanise(code?: string | null): string {
  if (!code) return ''
  const words = code
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.]+/g, ' ')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w))
  const text = words.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const SETTING_LABELS: Record<string, string> = {
  consultation_fee_ngn: 'Consultation fee',
  centre_booking_charge_ngn: 'Centre booking charge',
  session_minutes_fnph: 'Consultation length',
  session_minutes_centre: 'Centre consultation length',
  joining_grace_minutes: 'Early joining window',
  no_show_cutoff_minutes: 'No-show cut-off',
  cancellation_notice_hours: 'Cancellation notice',
  prescription_validity_days: 'Prescription validity',
  clinical_emergency_number: 'Clinical emergency number',
  helpdesk_email: 'Helpdesk email',
  recording_enabled: 'Consultation recording',
  session_inactivity_timeout_minutes: 'Idle sign-out',
}

/** Readable label for a configuration key, falling back to the key itself made readable. */
export function settingLabel(key: string): string {
  return SETTING_LABELS[key] ?? humanise(key)
}

/** The WAT calendar date (yyyy-MM-dd) of a server timestamp. */
export function watDate(value?: string | null): string {
  const date = parseServerTime(value)
  return date ? new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE }).format(date) : ''
}
