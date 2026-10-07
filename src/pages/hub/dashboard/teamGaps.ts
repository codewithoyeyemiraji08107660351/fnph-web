import type { TeamNames } from '@/lib/api/types'

const ROLES: Array<{ key: keyof TeamNames; label: string }> = [
  { key: 'doctor', label: 'doctor' },
  { key: 'room', label: 'room' },
  { key: 'nurse', label: 'nurse' },
  { key: 'pharmacist', label: 'pharmacist' },
  { key: 'laboratory', label: 'laboratory' },
  { key: 'him', label: 'HIM' },
]

/** Roles nobody holds. Doctor and room come first: without them the session cannot run. */
export function teamGaps(team: TeamNames): string[] {
  return ROLES.filter((r) => !team[r.key]).map((r) => r.label)
}

export function teamSummary(team: TeamNames): Array<{ label: string; name: string }> {
  return [
    { label: 'Nurse', name: team.nurse ?? '' },
    { label: 'Pharmacist', name: team.pharmacist ?? '' },
    { label: 'Laboratory', name: team.laboratory ?? '' },
    { label: 'HIM', name: team.him ?? '' },
  ].filter((m) => m.name)
}