import { api, seg } from '../http'
import type {
  Appointment,
  AppointmentHistory,
  ApprovalQueue,
  ApproveRequest,
  DoctorAvailability,
  ReleaseBundle,
  ReleaseDeskRow,
  ReviewRow,
  RoomOption,
  StaffOption,
} from '../types'

export const approvalsApi = {
  queue: (page = 0, size = 50) => api.get<ApprovalQueue>('/hub/approvals', { params: { page, size } }),
  /** JSON body. Moves money at approval, so it is never retried automatically. */
  approve: (appointmentPublicId: string, body: ApproveRequest) =>
    api.post<Appointment>(`/hub/approvals/${seg(appointmentPublicId)}/approve`, body),
  /** Query parameter. The patient is shown this reason. */
  reject: (appointmentPublicId: string, reason: string) =>
    api.post<Appointment>(`/hub/approvals/${seg(appointmentPublicId)}/reject`, null, { params: { reason } }),
  history: (appointmentPublicId: string) => api.get<AppointmentHistory[]>(`/hub/approvals/${seg(appointmentPublicId)}/history`),
  /** Gated on appointment.assign_team. The coordinator does not hold user.read. */
  staff: (role?: string) => api.get<StaffOption[]>('/hub/approvals/assignable-staff', { params: { role } }),
  rooms: (type?: RoomOption['roomType']) => api.get<RoomOption[]>('/admin/rooms', { params: { type } }),
  availability: (serviceDate: string) => api.get<DoctorAvailability[]>('/admin/availability', { params: { serviceDate } }),
}

export const releaseApi = {
  desk: (status?: ReleaseDeskRow['status']) => api.get<ReleaseDeskRow[]>('/hub/releases', { params: { status } }),
  get: (bundlePublicId: string) => api.get<ReleaseBundle>(`/hub/releases/${seg(bundlePublicId)}`),
  /** All or nothing. */
  release: (bundlePublicId: string, notes?: string) =>
    api.post<ReleaseBundle>(`/hub/releases/${seg(bundlePublicId)}/release`, null, { params: { notes } }),
  block: (bundlePublicId: string, reason: string) =>
    api.post<ReleaseBundle>(`/hub/releases/${seg(bundlePublicId)}/block`, null, { params: { reason } }),
  queries: () => api.get<ReviewRow[]>('/reviews/queries'),
}
