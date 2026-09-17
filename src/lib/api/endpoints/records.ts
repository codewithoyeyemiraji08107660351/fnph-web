import { api, http, seg } from '../http'
import type { Page } from '../types'
import type { FinanceReport } from './finance'

/* ---------------- consent and triage versions ---------------- */

export type Audience = 'FNPH_PATIENT' | 'CENTRE'

export interface ConsentVersion {
  publicId: string
  audience: Audience
  version: string
  title: string
  body: string
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED'
  /** The seeded text still says PLACEHOLDER; the server refuses to publish it. */
  placeholder: boolean
  effectiveFrom?: string
  retiredAt?: string
  publishedBy?: string
  createdAt: string
}

export interface TriageQuestionDraft {
  questionText: string
  stopAnswer: 'YES' | 'NO'
  stopReason: string
}

export interface TriageSetVersion {
  publicId: string
  audience: Audience
  version: string
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED'
  placeholder: boolean
  effectiveFrom?: string
  retiredAt?: string
  createdAt: string
  questions: Array<TriageQuestionDraft & { sequence: number }>
}

export const versionsApi = {
  consent: (audience: Audience) => api.list<ConsentVersion>('/admin/consent', { params: { audience } }),
  createConsent: (body: { audience: Audience; version: string; title: string; body: string }) => api.post<ConsentVersion>('/admin/consent', body),
  editConsent: (id: string, body: { title: string; body: string }) => api.put<ConsentVersion>(`/admin/consent/${seg(id)}`, body),
  /** Retires the published version for that audience. */
  publishConsent: (id: string) => api.post<unknown>(`/admin/consent/${seg(id)}/publish`),
  triage: (audience: Audience) => api.list<TriageSetVersion>('/admin/triage', { params: { audience } }),
  createTriage: (body: { audience: Audience; version: string; questions: TriageQuestionDraft[] }) => api.post<TriageSetVersion>('/admin/triage', body),
  publishTriage: (id: string) => api.post<unknown>(`/admin/triage/${seg(id)}/publish`),
}

/* ---------------- appointment lifecycle ---------------- */

export interface CancellationRow {
  publicId: string
  appointmentReference: string
  appointmentPublicId: string
  appointmentDate: string
  appointmentStatus: string
  patientName: string
  requestType: 'CANCEL' | 'RESCHEDULE'
  reason: string
  hoursNotice: number
  requestedAt: string
  requestedBy: string
  proposedTime?: string
}

export interface DayRow {
  publicId: string
  reference: string
  status: string
  appointmentDate: string
  scheduledEndAt: string
  room?: string
  patientName: string
  ehrNumber: string
  doctorName?: string
}

export const lifecycleApi = {
  /** Query parameters. A request, decided by the hub. */
  requestChange: (appointmentId: string, p: { requestType: 'CANCEL' | 'RESCHEDULE'; reason: string; proposedSlotPublicId?: string }) =>
    api.post<{ publicId: string; hoursNotice: number; requiredNoticeHours: number; withinNoticePeriod: boolean; status: string }>(
      `/appointments/${seg(appointmentId)}/cancel-request`, null, { params: p }),
  /** Moves straight away and goes back to the hub for a new doctor and room. */
  reschedule: (appointmentId: string, newSlotPublicId: string, reason: string) =>
    api.post<{ reference: string; newTime: string; status: string }>(`/appointments/${seg(appointmentId)}/reschedule`, null, { params: { newSlotPublicId, reason } }),
  cancellations: () => api.list<CancellationRow>('/appointments/cancellations'),
  decide: (requestId: string, approve: boolean, notes?: string) =>
    api.post<void>(`/appointments/cancellations/${seg(requestId)}/decide`, null, { params: { approve, notes } }),
  noShow: (appointmentId: string, notes: string) => api.post<void>(`/appointments/${seg(appointmentId)}/no-show`, null, { params: { notes } }),
  day: (date: string) => api.list<DayRow>('/appointments/day', { params: { date } }),
}

/* ---------------- patient records and manual enrolment ---------------- */

export interface PatientRecord {
  publicId: string
  ehrNumber: string
  firstName: string
  lastName: string
  phoneNumber?: string
  email?: string
  isActive: boolean
  activatedAt?: string
  driftFlagged?: boolean
  eligibilityVerifiedBy?: string
  eligibilityVerifiedAt?: string
  driftDetails?: string
}

export const patientRecordsApi = {
  me: () => api.get<PatientRecord>('/patients/me'),
  search: (term: string, page = 0) => api.list<PatientRecord>('/patients', { params: { term: term || undefined, page, size: 50 } }),
  get: (id: string) => api.get<PatientRecord>(`/patients/${seg(id)}`),
  update: (id: string, fields: { phoneNumber?: string; email?: string; address?: string }) => api.put<{ updated: boolean }>(`/patients/${seg(id)}`, null, { params: fields }),
  deactivate: (id: string, reason: string) => api.post<void>(`/patients/${seg(id)}/deactivate`, null, { params: { reason } }),
  drift: (page = 0) => api.list<{ publicId: string; ehrNumber: string; name: string; flaggedAt?: string; details?: string }>('/patients/drift', { params: { page, size: 50 } }),
  clearDrift: (id: string, notes: string) => api.post<void>(`/patients/${seg(id)}/drift/clear`, null, { params: { notes } }),
  /** Closes an enrolment check that could not match. Creates an inactive record. */
  createManual: (p: { ehrNumber: string; firstName: string; lastName: string; dateOfBirth: string; phoneNumber?: string; email?: string; verificationRequestPublicId: string; verifiedHow: string }) =>
    api.post<{ publicId: string; ehrNumber: string; active: boolean; next: string }>('/admin/patients', null, { params: p }),
  verify: (id: string, assessmentDetail: string) => api.post<void>(`/admin/patients/${seg(id)}/verify`, null, { params: { assessmentDetail } }),
  activate: (id: string) => api.post<{ username: string; status: string; setupLinkSent: boolean; note: string }>(`/admin/patients/${seg(id)}/activate`),
  /** Who is waiting at a desk for an enrolment code. The code itself is never returned. */
  pendingCodes: () => api.list<{ publicId: string; ehrNumber: string; destinationMasked?: string; expiresAt: string; attempts: number }>('/admin/enrolment/pending-codes'),
  financeReport: (patientPublicId: string) => api.get<FinanceReport>(`/finance/reports/patient/${seg(patientPublicId)}`),
}

/* ---------------- uploads ---------------- */

export type FileCategory = 'VITALS_EVIDENCE' | 'LABORATORY_RESULT' | 'SUPPORTING_DOCUMENT' | 'REFERRAL_ATTACHMENT' | 'OTHER'

export interface UploadRow {
  publicId: string
  originalFileName: string
  contentType: string
  sizeBytes: number
  category: string
  scanStatus: string
  description?: string
  uploadedBy: string
  uploadedAt: string
}

export const uploadsApi = {
  upload: (file: File, category: FileCategory, description?: string, referenceId?: string) => {
    const form = new FormData()
    form.append('file', file)
    return http.post<UploadRow>('/uploads', form, { params: { category, description, referenceId }, timeout: 120_000 }).then((r) => r.data)
  },
  mine: () => api.list<UploadRow>('/uploads/mine'),
  forReference: (referenceId: string) => api.list<UploadRow>('/uploads', { params: { referenceId } }),
  /** Always an attachment; never rendered in the page. */
  download: async (id: string) => {
    const r = await http.get<Blob>(`/uploads/${seg(id)}/content`, { responseType: 'blob', timeout: 120_000 })
    const name = /filename="?([^";]+)"?/.exec(String(r.headers['content-disposition'] ?? ''))?.[1] ?? 'file'
    return { blob: r.data, filename: name }
  },
  remove: (id: string, reason: string) => api.delete<void>(`/uploads/${seg(id)}`, { params: { reason } }),
  quarantine: (id: string, reason: string) => api.post<void>(`/admin/uploads/${seg(id)}/quarantine`, null, { params: { reason } }),
}

/** Saves a blob as a file without opening it in the page. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/* ---------------- documents, follow-ups, triage history, recording ---------------- */

export interface DocumentLookup {
  publicId: string
  issueNumber: string
  documentType: string
  status: string
  issuedAt?: string
  expiresAt?: string
  downloadCount: number
  maxDownloads: number
  revokedReason?: string
}

export const documentsAdminApi = {
  lookup: (issueNumber: string) => api.get<DocumentLookup>(`/clinical/documents/${seg(issueNumber)}`),
  /** Re-renders a document whose file failed to generate. */
  reissue: (issueNumber: string) => api.post<Record<string, unknown>>('/admin/documents/reissue', null, { params: { issueNumber } }),
  allowDownload: (issueNumber: string, reason: string) =>
    api.post<{ downloadCount: number; maxDownloads: number }>(`/admin/documents/${seg(issueNumber)}/allow-download`, null, { params: { reason } }),
  revoke: (publicId: string, reason: string) => api.post<unknown>(`/documents/${seg(publicId)}/revoke`, null, { params: { reason } }),
}

export const followUpsApi = {
  mine: () => api.list<{ publicId: string; recommendation: string; reviewInterval?: string; preferredDate?: string; createdAt: string }>('/clinical/follow-ups/mine'),
  get: (id: string) => api.get<{ publicId: string; recommendation: string; reviewInterval: string }>(`/clinical/follow-ups/${seg(id)}`),
}

export const triageHistoryApi = {
  mine: () => api.list<{ publicId: string; version: string; outcome: string; stopReason?: string; submittedAt: string }>('/triage/mine'),
}

export const recordingApi = {
  /** Refused while recording is switched off; the refusal is the answer to show. */
  start: (consultationId: string, consentAcceptancePublicId: string) =>
    api.post<Record<string, unknown>>(`/consultations/${seg(consultationId)}/recording/start`, null, { params: { consentAcceptancePublicId } }),
  list: (consultationId: string) => api.list<Record<string, unknown>>(`/consultations/${seg(consultationId)}/recording`),
}

/** The deprecated centre join: details only, no token. Kept for completeness; the room uses join/centre. */
export const legacyCentreJoinApi = {
  details: (centreAppointmentId: string) =>
    api.post<{ reference: string; appointmentDateTime: string; room: string; isOwner: boolean; note: string }>(`/consultations/centre/${seg(centreAppointmentId)}/join`),
}

export type { Page }
