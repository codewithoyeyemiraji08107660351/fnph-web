import { api, seg } from '../http'
import type {
  Appointment,
  AppointmentHistory,
  ApprovalQueue,
  ApproveRequest,
  DoctorAvailability,
  EditFollowUpBody,
  EditReviewBody,
  EditRevisionRow,
  HubFollowUpRow,
  HubReviewRow,
  HubStats,
  ReassignableRole,
  ReassignRequest,
  TeamResponse,
  WorkflowBoard,
  WorkflowStage,
  WorkflowTimeline,
  ReleaseBundle,
  ReleaseDeskRow,
  ReviewRow,
  RoomOption,
  StaffOption,
  ActivityGroup,
  ActivityPage,
} from '../types'

export const approvalsApi = {
  queue: (page = 0, size = 50) =>
    api.get<ApprovalQueue>('/hub/approvals', {
      params: { page, size },
    }),

  /** JSON body. Moves money at approval, so it is never retried automatically. */
  approve: (
    appointmentPublicId: string,
    body: ApproveRequest,
  ) =>
    api.post<Appointment>(
      `/hub/approvals/${seg(appointmentPublicId)}/approve`,
      body,
    ),

  /** Query parameter. The patient is shown this reason. */
  reject: (
    appointmentPublicId: string,
    reason: string,
  ) =>
    api.post<Appointment>(
      `/hub/approvals/${seg(appointmentPublicId)}/reject`,
      null,
      { params: { reason } },
    ),

  history: (appointmentPublicId: string) =>
    api.list<AppointmentHistory>(
      `/hub/approvals/${seg(appointmentPublicId)}/history`,
    ),

  /** Gated on appointment.assign_team. The coordinator does not hold user.read. */
  staff: (role?: string) =>
    api.list<StaffOption>(
      '/hub/approvals/assignable-staff',
      { params: { role } },
    ),

  rooms: (type?: RoomOption['roomType']) =>
    api.list<RoomOption>(
      '/admin/rooms',
      { params: { type } },
    ),

  availability: (serviceDate: string) =>
    api.list<DoctorAvailability>(
      '/admin/availability',
      { params: { serviceDate } },
    ),
}

export const releaseApi = {
  /**
   * Administrative release desk.
   *
   * This endpoint intentionally contains no clinical content.
   */
  desk: (status?: ReleaseDeskRow['status']) =>
    api.list<ReleaseDeskRow>(
      '/hub/releases',
      { params: { status } },
    ),

  /**
   * Complete single-bundle view.
   *
   * The response contains:
   * - component completion state
   * - clinical note
   * - prescriptions and medicines
   * - investigations and panels
   * - follow-up recommendations
   *
   * All clinical data is read-only.
   */
  get: (bundlePublicId: string) =>
    api.get<ReleaseBundle>(
      `/hub/releases/${seg(bundlePublicId)}`,
    ),

  /** All or nothing. */
  release: (
    bundlePublicId: string,
    notes?: string,
  ) =>
    api.post<ReleaseBundle>(
      `/hub/releases/${seg(bundlePublicId)}/release`,
      null,
      {
        params: { notes },
      },
    ),

  block: (
    bundlePublicId: string,
    reason: string,
  ) =>
    api.post<ReleaseBundle>(
      `/hub/releases/${seg(bundlePublicId)}/block`,
      null,
      {
        params: { reason },
      },
    ),

  queries: () =>
    api.list<ReviewRow>('/reviews/queries'),
}

/** Hub Coordinator oversight of one consultation. Keyed by appointment. */
export const oversightApi = {
  /** Every pharmacy and laboratory review, including verified ones with notes. */
  reviews: (appointmentPublicId: string) =>
    api.list<HubReviewRow>(
      `/hub/appointments/${seg(appointmentPublicId)}/reviews`,
    ),

  /** Gated on hub.clinical_edit. 409 when the review changed since it was loaded. */
  editReview: (appointmentPublicId: string, reviewPublicId: string, body: EditReviewBody) =>
    api.put<HubReviewRow>(
      `/hub/appointments/${seg(appointmentPublicId)}/reviews/${seg(reviewPublicId)}`,
      body,
    ),

  followUps: (appointmentPublicId: string) =>
    api.list<HubFollowUpRow>(
      `/hub/appointments/${seg(appointmentPublicId)}/follow-ups`,
    ),

  /** Full replacement of the scheduling fields. Gated on hub.clinical_edit. */
  editFollowUp: (appointmentPublicId: string, followUpPublicId: string, body: EditFollowUpBody) =>
    api.put<HubFollowUpRow>(
      `/hub/appointments/${seg(appointmentPublicId)}/follow-ups/${seg(followUpPublicId)}`,
      body,
    ),

  /** Booking to follow-up, oldest first, with stage, team and durations. */
  timeline: (appointmentPublicId: string) =>
    api.get<WorkflowTimeline>(`/hub/appointments/${seg(appointmentPublicId)}/timeline`),

  /** Current team plus every change, newest first. */
  team: (appointmentPublicId: string) =>
    api.get<TeamResponse>(`/hub/appointments/${seg(appointmentPublicId)}/team`),

  /**
   * Assign or replace one team member after approval. Gated on
   * appointment.assign_team (and assign_doctor for DOCTOR). Open pharmacy or
   * laboratory reviews move with the role. Returns the team as it now stands.
   */
  reassign: (appointmentPublicId: string, role: ReassignableRole, body: ReassignRequest) =>
    api.post<TeamResponse>(
      `/hub/appointments/${seg(appointmentPublicId)}/team/${seg(role)}`,
      body,
    ),

  /** Newest first. Rows sharing editGroup were saved together. */
  edits: (appointmentPublicId: string) =>
    api.list<EditRevisionRow>(
      `/hub/appointments/${seg(appointmentPublicId)}/edits`,
    ),
}

/** Hub Coordinator dashboard. Dates are hospital days, YYYY-MM-DD, inclusive. */
export const dashboardApi = {
  /** Defaults to the last 30 days. */
  stats: (params: { from?: string; to?: string } = {}) =>
    api.get<HubStats>('/hub/stats', { params }),

  /** Defaults to 30 days back and 14 ahead. At most 92 days. */
  workflow: (params: {
    from?: string
    to?: string
    stage?: WorkflowStage
    q?: string
    /** asc lists soonest first, for an upcoming list. */
    order?: 'asc' | 'desc'
    page?: number
    size?: number
  } = {}) => api.get<WorkflowBoard>('/hub/workflow', { params }),

  /** Newest first. Repeat group for several; page with the previous nextBefore. */
  activity: (params: {
    from?: string
    to?: string
    group?: ActivityGroup[]
    before?: string
    limit?: number
  } = {}) =>
    api.get<ActivityPage>('/hub/activity', {
      params,
      // group=APPROVED&group=REJECTED, which Spring binds to a List.
      paramsSerializer: { indexes: null },
    }),
}