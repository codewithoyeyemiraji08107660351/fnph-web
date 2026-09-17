import { api, http, seg } from '../http'
import type { CentreRow, DoctorAvailability, RoomOption } from '../types'

/* ---------------- 4A scheduling ---------------- */

export type Audience = 'FNPH_PATIENT' | 'CENTRE'

/** ScheduleDtos.PublicationResponse. windowStart and windowEnd are hospital time. */
export interface Publication {
  publicId: string
  audience: Audience
  serviceDate: string
  windowStart: string
  windowEnd: string
  slotMinutes: number
  status: 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN'
  slotsGenerated: number
  publishedBy?: string
  publishedAt?: string
  withdrawReason?: string
}

export interface SlotRow {
  publicId: string
  startAt: string
  endAt: string
  state: 'AVAILABLE' | 'HELD' | 'BOOKED' | 'BLOCKED'
  room?: string
  blockedReason?: string
}

export const schedulingApi = {
  /** The only JSON body in 4A. A draft generates slots without opening the day. */
  publish: (body: { audience: Audience; serviceDate: string; windowStart: string; windowEnd: string; publishImmediately: boolean }) =>
    api.post<Publication>('/admin/schedules', body),
  list: (from: string, to: string) => api.list<Publication>('/admin/schedules', { params: { from, to } }),
  slots: (id: string) => api.list<SlotRow>(`/admin/schedules/${seg(id)}/slots`),
  open: (id: string) => api.post<Publication>(`/admin/schedules/${seg(id)}/publish`),
  /** Stops new bookings. Existing ones stand. */
  withdraw: (id: string, reason: string) => api.post<Publication>(`/admin/schedules/${seg(id)}/withdraw`, null, { params: { reason } }),
  block: (slotId: string, reason: string) => api.post<void>(`/admin/schedules/slots/${seg(slotId)}/block`, null, { params: { reason } }),
  unblock: (slotId: string) => api.post<void>(`/admin/schedules/slots/${seg(slotId)}/unblock`),
  rooms: (type?: RoomOption['roomType']) => api.list<RoomOption>('/admin/rooms', { params: { type } }),
  addRoom: (p: { code: string; name: string; roomType: RoomOption['roomType']; capacityNotes?: string }) =>
    api.post<{ publicId: string; code: string }>('/admin/rooms', null, { params: p }),
  /** Closes the room's open future slots and reports booked ones to move. */
  deactivateRoom: (id: string) => api.post<{ roomCode: string; openSlotsClosed: number; bookedSlotsToMove: number }>(`/admin/rooms/${seg(id)}/deactivate`),
  availability: (serviceDate: string) => api.list<DoctorAvailability>('/admin/availability', { params: { serviceDate } }),
  /** Six query parameters; serviceDate is the key the list filters on and must agree with the times. */
  setAvailability: (p: { doctorPublicId: string; serviceDate: string; startAt: string; endAt: string; available: boolean; reason?: string }) =>
    api.post<unknown>('/admin/availability', null, { params: p }),
}

/* ---------------- centres and capabilities ---------------- */

export interface CapabilityState {
  capability: 'PHARMACY' | 'LABORATORY' | 'HIM'
  unlocksRole: string
  enabled: boolean
  enabledAt?: string
  enabledBy?: string
  enableReason?: string
  disabledAt?: string
  disabledBy?: string
  disableReason?: string
}

export const centresAdminApi = {
  list: () => api.list<CentreRow>('/admin/centres'),
  create: (p: { code: string; name: string; lga?: string; address?: string }) => api.post<unknown>('/admin/centres', null, { params: p }),
  setStatus: (id: string, status: 'SETUP' | 'ACTIVE' | 'SUSPENDED', reason?: string) =>
    api.post<unknown>(`/admin/centres/${seg(id)}/activate`, null, { params: { status, reason } }),
  update: (id: string, p: { name?: string; lga?: string; address?: string; contactPhone?: string }) =>
    api.put<unknown>(`/admin/centres/${seg(id)}`, null, { params: p }),
  capabilities: (id: string) => api.list<CapabilityState>(`/admin/centres/${seg(id)}/capabilities`),
  setCapability: (id: string, capability: CapabilityState['capability'], enabled: boolean, reason: string) =>
    api.put<CapabilityState>(`/admin/centres/${seg(id)}/capabilities/${capability}`, { enabled, reason }),
}

/* ---------------- notifications ---------------- */

export interface TemplateRow {
  publicId: string
  notificationType: string
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH'
  subject?: string
  body: string
  active: boolean
  updatedReason?: string
}

export interface BroadcastRow {
  subject: string
  target: string
  centre?: string
  sentBy: string
  sentAt: string
  recipients: number
  reason: string
}

export const notificationsAdminApi = {
  templates: () => api.list<TemplateRow>('/admin/notifications/templates'),
  saveTemplate: (type: string, p: { channel: TemplateRow['channel']; subject?: string; body: string; reason: string }) =>
    api.put<unknown>(`/admin/notifications/templates/${seg(type)}`, null, { params: p }),
  /** Leaving both filters blank sends to every account in the system. */
  broadcast: (p: { subject: string; body: string; targetRole?: string; centrePublicId?: string; reason: string }) =>
    api.post<Record<string, unknown>>('/admin/notifications/broadcast', null, { params: p }),
  broadcasts: () => api.list<BroadcastRow>('/admin/notifications/broadcasts'),
}

/* ---------------- 4C ICT and records ---------------- */

export interface EhrImport {
  publicId: string
  fileName: string
  status: string
  sourceAsAt: string
  ageInDays: number
  rowCount: number
  validRowCount: number
  rejectedRowCount: number
  validationReport?: string
  driftDetectedCount: number
  uploadedBy: string
  uploadedAt: string
  activatedAt?: string
  activatedBy?: string
}

export type VerificationStatus = 'SUBMITTED' | 'WITH_HIM' | 'WITH_ICT' | 'RESOLVED' | 'REJECTED'

export interface VerificationRequest {
  publicId: string
  ehrNumberClaimed: string
  fullName: string
  dateOfBirth?: string
  phoneNumber?: string
  preferredContact?: string
  supportingNote?: string
  status: VerificationStatus
  submittedAt: string
}

export const ictApi = {
  imports: () => api.list<EhrImport>('/admin/ehr-imports'),
  /** 404 when nothing is active: nobody can enrol. */
  active: () => api.get<EhrImport>('/admin/ehr-imports/active'),
  /** Validates only. Activation is a separate decision by someone else. */
  upload: (file: File, sourceAsAt: string) => {
    const form = new FormData()
    form.append('file', file)
    return http.post<EhrImport>('/admin/ehr-imports', form, { params: { sourceAsAt }, timeout: 120_000 }).then((r) => r.data)
  },
  activate: (id: string, reason: string) => api.post<EhrImport>(`/admin/ehr-imports/${seg(id)}/activate`, null, { params: { reason } }),
  /** A plain list: the controller returns the page's content, not the page. */
  verificationQueue: (status?: VerificationStatus, page = 0) =>
    api.list<VerificationRequest>('/admin/verification-requests', { params: { status, page, size: 50 } }),
  assignVerification: (id: string, status: 'WITH_HIM' | 'WITH_ICT') =>
    api.post<void>(`/admin/verification-requests/${seg(id)}/assign`, null, { params: { status } }),
  resolveVerification: (id: string, outcome: 'RESOLVED' | 'REJECTED', notes: string, patientPublicId?: string) =>
    api.post<void>(`/admin/verification-requests/${seg(id)}/resolve`, null, { params: { outcome, notes, patientPublicId } }),
  quarantined: () => api.list<{ publicId: string; originalFileName: string; uploadedBy: string; uploadedAt: string; scanResult?: string }>('/admin/uploads/quarantined'),
}