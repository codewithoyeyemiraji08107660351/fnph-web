import { useQueryClient } from '@tanstack/react-query'

import type { ReassignableRole, TeamRole, WorkflowStage } from '@/lib/api/types'

export const oversightKeys = {
  reviews: (appointmentPublicId: string) => ['hub-reviews', appointmentPublicId] as const,
  followUps: (appointmentPublicId: string) => ['hub-follow-ups', appointmentPublicId] as const,
  edits: (appointmentPublicId: string) => ['hub-edits', appointmentPublicId] as const,
  team: (appointmentPublicId: string) => ['hub-team', appointmentPublicId] as const,
  timeline: (appointmentPublicId: string) => ['hub-timeline', appointmentPublicId] as const,
}

/** After any hub edit: refresh the panels and the bundle's clinical contents. */
export function useRefreshOversight(appointmentPublicId: string) {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: oversightKeys.reviews(appointmentPublicId) }),
      qc.invalidateQueries({ queryKey: oversightKeys.followUps(appointmentPublicId) }),
      qc.invalidateQueries({ queryKey: oversightKeys.edits(appointmentPublicId) }),
      qc.invalidateQueries({ queryKey: oversightKeys.timeline(appointmentPublicId) }),
      qc.invalidateQueries({ queryKey: ['bundle'] }),
    ])
}

/**
 * After a team change. The team, its reviews and the timeline change on this
 * consultation, and the desk, bundle and dashboard counts all move with them.
 */
export function useRefreshAfterTeamChange() {
  const qc = useQueryClient()
  return (appointmentPublicId: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: oversightKeys.team(appointmentPublicId) }),
      qc.invalidateQueries({ queryKey: oversightKeys.reviews(appointmentPublicId) }),
      qc.invalidateQueries({ queryKey: oversightKeys.timeline(appointmentPublicId) }),
      ...['bundle', 'release-desk', 'hub-board', 'hub-stats', 'hub-activity', 'hub-upcoming', 'hub-day'].map((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      ),
    ])
}

/**
 * How often the hub's live panels re-read the server, and whether coming back
 * to the tab triggers a read. The app default (no focus refetch, 30 s stale)
 * suits reference data, not a desk that other people are changing.
 */
export const LIVE = { refetchInterval: 30_000, refetchOnWindowFocus: true, staleTime: 10_000 } as const

/** Labels for the edit history. Keys match the backend field names. */
export const FIELD_LABEL: Record<string, string> = {
  notes: 'Notes',
  queryDetail: 'Query',
  preferredDate: 'Preferred date',
  preferredTime: 'Preferred time',
  consultationMode: 'Mode',
  status: 'Status',
  scheduledDate: 'Scheduled date',
  completedDate: 'Completed date',
}

export const REASON_MIN = 10

export const ROLE_LABEL: Record<TeamRole, string> = {
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  PHARMACIST: 'Pharmacist',
  LABORATORY: 'Laboratory technician',
  HIM: 'HIM officer',
  ROOM: 'Room',
}

/** The account role code a person must hold to fill each team role. */
export const ROLE_CODE: Record<ReassignableRole, string> = {
  DOCTOR: 'DOCTOR',
  NURSE: 'NURSING',
  PHARMACIST: 'PHARMACIST',
  LABORATORY: 'LABORATORY_TECHNICIAN',
  HIM: 'HIM',
}

export const STAGE_LABEL: Record<WorkflowStage, string> = {
  PAYMENT: 'Awaiting payment',
  APPROVAL: 'Awaiting approval',
  SCHEDULED: 'Scheduled',
  IN_SESSION: 'In session',
  DOCUMENTATION: 'Documentation',
  REVIEWS: 'In review',
  AWAITING_RELEASE: 'Ready to release',
  HELD: 'Held',
  FOLLOW_UP: 'Follow-up open',
  CLOSED: 'Closed',
  ENDED: 'Did not run',
}

/** Where the hub has work to do, the tone says so. */
export const STAGE_TONE: Record<WorkflowStage, 'grey' | 'green' | 'gold' | 'red' | 'navy'> = {
  PAYMENT: 'grey',
  APPROVAL: 'gold',
  SCHEDULED: 'navy',
  IN_SESSION: 'navy',
  DOCUMENTATION: 'grey',
  REVIEWS: 'grey',
  AWAITING_RELEASE: 'gold',
  HELD: 'red',
  FOLLOW_UP: 'gold',
  CLOSED: 'green',
  ENDED: 'grey',
}

/** 95 -> "1 h 35 min"; 2900 -> "2 d 0 h". Absent -> null. */
export function formatMinutes(minutes?: number | null): string | null {
  if (minutes == null) return null
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} h ${minutes % 60} min`
  return `${Math.floor(hours / 24)} d ${hours % 24} h`
}
