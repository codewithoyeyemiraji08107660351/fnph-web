import { api, seg } from '../http'
import type { StaffWorkRow, WorkPage, WorkRole, WorkSummary } from '../types'

export interface WorkQuery {
  role?: WorkRole
  from: string
  to: string
}

export interface WorkItemsQuery extends WorkQuery {
  kind?: 'RECORDS' | 'VERIFICATIONS'
  q?: string
  page?: number
  size?: number
}

/** Whose work: the signed-in person, or a named team member for the Hub Coordinator. */
export type WorkSubject = { kind: 'me' } | { kind: 'staff'; userPublicId: string }

const base = (who: WorkSubject) =>
  who.kind === 'me' ? '/me/work' : `/hub/staff-work/${seg(who.userPublicId)}`

export const staffWorkApi = {
  summary: (who: WorkSubject, query: WorkQuery) =>
    api.get<WorkSummary>(base(who), { params: query }),

  items: (who: WorkSubject, query: WorkItemsQuery) =>
    api.get<WorkPage>(`${base(who)}/items`, { params: { ...query, q: query.q?.trim() || undefined } }),

  /** Gated on release_bundle.read. */
  staff: (query: { from: string; to: string }) =>
    api.list<StaffWorkRow>('/hub/staff-work', { params: query }),
}
