import type { DoctorAvailability, StaffOption } from '@/lib/api/types'
import { formatTime, parseServerTime } from '@/lib/format'

export interface DoctorChoice {
  publicId: string
  name: string
  /** Shown after the name: on the rota, or why they cannot take this slot. */
  note?: string
  /** Marked unavailable for some part of the slot. The server refuses them. */
  unavailable: boolean
}

/**
 * Every active doctor, like the rest of the team.
 *
 * The rota no longer decides who can be assigned. A doctor marked unavailable
 * for any part of the slot is listed but cannot be picked; a doctor on the
 * rota for the whole slot is listed first. Another consultation at the same
 * time is still refused by the server.
 */
export function doctorChoices(
  staff: StaffOption[] | undefined,
  rota: DoctorAvailability[] | undefined,
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): DoctorChoice[] {
  const start = parseServerTime(startIso)?.getTime() ?? 0
  const rawEnd = parseServerTime(endIso)?.getTime() ?? start
  // A slot with no end is checked as a moment at its start, as on the server.
  const end = rawEnd > start ? rawEnd : start + 60_000
  const entries = rota ?? []

  const choices = (staff ?? [])
    .filter((s) => s.roles.includes('DOCTOR'))
    .map((s): DoctorChoice & { rank: number } => {
      const mine = entries.filter((a) => a.doctorPublicId === s.publicId)
      const off = mine.find(
        (a) =>
          !a.available &&
          (parseServerTime(a.startAt)?.getTime() ?? Infinity) < end &&
          (parseServerTime(a.endAt)?.getTime() ?? 0) > start,
      )
      if (off) {
        return {
          publicId: s.publicId,
          name: s.fullName,
          note: off.reason ? `unavailable: ${off.reason}` : 'marked unavailable',
          unavailable: true,
          rank: 2,
        }
      }
      const on = mine.find(
        (a) =>
          a.available &&
          (parseServerTime(a.startAt)?.getTime() ?? Infinity) <= start &&
          (parseServerTime(a.endAt)?.getTime() ?? 0) >= end,
      )
      return {
        publicId: s.publicId,
        name: s.fullName,
        note: on ? `on rota ${formatTime(on.startAt)} to ${formatTime(on.endAt)}` : undefined,
        unavailable: false,
        rank: on ? 0 : 1,
      }
    })

  return choices
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .map((c) => ({ publicId: c.publicId, name: c.name, note: c.note, unavailable: c.unavailable }))
}

export const choiceLabel = (c: DoctorChoice) => (c.note ? `${c.name} (${c.note})` : c.name)
