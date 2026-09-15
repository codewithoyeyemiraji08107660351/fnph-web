import { api, seg } from '../http'
import type {
  ClinicalComponent,
  ClinicalDocument,
  ClinicalNote,
  ConsultationRecord,
  ConsultationSummary,
  DoctorQueueRow,
  InvestigationDetail,
  InvestigationItem,
  JoinResponse,
  PrescriptionDetail,
  PrescriptionItem,
  ReviewRow,
  TerminationReason,
  VitalsReading,
  WorkQueueRow,
} from '../types'

export type QueueKind = 'nursing' | 'him'

export const workQueueApi = {
  list: (kind: QueueKind) => api.get<WorkQueueRow[]>(`/clinical/queues/${kind}`),
  start: (kind: QueueKind, id: string) => api.post<unknown>(`/queues/${kind}/${seg(id)}/start`),
  complete: (kind: QueueKind, id: string, notes?: string) =>
    api.post<unknown>(`/queues/${kind}/${seg(id)}/complete`, null, { params: { notes } }),
  exception: (kind: QueueKind, id: string, reason: string) =>
    api.post<unknown>(`/queues/${kind}/${seg(id)}/exception`, null, { params: { reason } }),
  vitals: (appointmentPublicId: string) => api.get<VitalsReading[]>(`/clinical/vitals/appointments/${seg(appointmentPublicId)}`),
  verifyVitals: (vitalsPublicId: string) => api.post<VitalsReading>(`/clinical/vitals/${seg(vitalsPublicId)}/verify`),
  doctorQueue: () => api.get<DoctorQueueRow[]>('/clinical/queues/doctor'),
}

export const consultationApi = {
  /** Creates the room on first call. A state change, never a retry target. */
  joinAsDoctor: (appointmentPublicId: string) => api.post<JoinResponse>(`/consultations/${seg(appointmentPublicId)}/join/doctor`),
  joinAsPatient: (appointmentPublicId: string) => api.post<JoinResponse>(`/consultations/${seg(appointmentPublicId)}/join/patient`),
  confirmIdentity: (consultationPublicId: string) => api.post<void>(`/consultations/${seg(consultationPublicId)}/identity-confirmed`),
  switchModality: (consultationPublicId: string, modality: 'VIDEO' | 'AUDIO' | 'PHONE_FALLBACK', reason?: string) =>
    api.post<void>(`/consultations/${seg(consultationPublicId)}/modality`, null, { params: { modality, reason } }),
  terminate: (consultationPublicId: string, body: { reason: TerminationReason; note?: string; safetyAction: string }) =>
    api.post<void>(`/consultations/${seg(consultationPublicId)}/terminate`, body),
  /** Fire and forget. */
  reportQuality: (consultationPublicId: string, role: 'DOCTOR' | 'PATIENT', metrics: { roundTripMs?: number; packetLossPercent?: number; videoQuality?: string }) =>
    api.post<void>(`/consultations/${seg(consultationPublicId)}/quality`, null, { params: { role, ...metrics } }).catch(() => undefined),
}

const base = (id: string) => `/clinical/consultations/${seg(id)}`

export const recordApi = {
  summary: (consultationPublicId: string) => api.get<ConsultationSummary>(`/clinical/consultations/${seg(consultationPublicId)}`),
  record: (consultationPublicId: string) => api.get<ConsultationRecord>(`${base(consultationPublicId)}/record`),
  history: (consultationPublicId: string) => api.get<ClinicalNote[]>(`${base(consultationPublicId)}/note/history`),
  save: (consultationPublicId: string, clinicalNote: string) => api.put<ClinicalNote>(`${base(consultationPublicId)}/note`, { clinicalNote }),
  sign: (consultationPublicId: string, body: { followUpRecommendation?: string; followUpTimeline?: string }) =>
    api.post<ClinicalNote>(`${base(consultationPublicId)}/note/sign`, body),
  amend: (consultationPublicId: string, body: { clinicalNote: string; amendmentReason: string }) =>
    api.post<ClinicalNote>(`${base(consultationPublicId)}/note/amend`, body),
  /** clinicalInformation is for the reviewer and is never the note. */
  issuePrescription: (consultationPublicId: string, body: { clinicalInformation?: string; items: PrescriptionItem[] }) =>
    api.post<ClinicalDocument>(`${base(consultationPublicId)}/prescriptions`, body),
  supersedePrescription: (consultationPublicId: string, prescriptionPublicId: string, body: { reason: string; clinicalInformation?: string; items: PrescriptionItem[] }) =>
    api.post<ClinicalDocument>(`${base(consultationPublicId)}/prescriptions/${seg(prescriptionPublicId)}/supersede`, body),
  issueInvestigation: (consultationPublicId: string, body: { clinicalInformation?: string; items: InvestigationItem[] }) =>
    api.post<ClinicalDocument>(`${base(consultationPublicId)}/investigations`, body),
  followUp: (consultationPublicId: string, body: { recommendation: string; reviewInterval?: string; preferredDate?: string }) =>
    api.post<void>(`${base(consultationPublicId)}/follow-up`, body),
  notRequired: (consultationPublicId: string, component: ClinicalComponent, reason: string) =>
    api.post<void>(`${base(consultationPublicId)}/not-required`, { component, reason }),
}

export type ReviewKind = 'pharmacy' | 'laboratory'

export const reviewApi = {
  /**
    Both queues return whatever is assigned to the caller; the server does not
    filter by type. Filtered here so each screen matches its title.
  */
  queue: async (kind: ReviewKind) => {
    const rows = await api.get<ReviewRow[]>(`/reviews/${kind}/queue`)
    const wanted = kind === 'pharmacy' ? 'PRESCRIPTION' : 'INVESTIGATION'
    return rows.filter((r) => r.documentType === wanted)
  },
  open: (reviewPublicId: string) => api.post<void>(`/reviews/${seg(reviewPublicId)}/open`),
  /** Forward only. A query does not return the document to the doctor. */
  submit: (reviewPublicId: string, body: { outcome: 'VERIFIED' | 'QUERY_RAISED'; notes?: string; queryDetail?: string }) =>
    api.post<void>(`/reviews/${seg(reviewPublicId)}/submit`, body),
  prescription: (publicId: string) => api.get<PrescriptionDetail>(`/clinical/prescriptions/${seg(publicId)}`),
  investigation: (publicId: string) => api.get<InvestigationDetail>(`/clinical/investigations/${seg(publicId)}`),
}
