import { api, seg } from '../http'
import type {
  ClinicalComponent,
  ClinicalDocument,
  CentreDoctorRow,
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
  list: (kind: QueueKind) => api.list<WorkQueueRow>(`/clinical/queues/${kind}`),
  start: (kind: QueueKind, id: string) => api.post<unknown>(`/queues/${kind}/${seg(id)}/start`),
  complete: (kind: QueueKind, id: string, notes?: string) =>
    api.post<unknown>(`/queues/${kind}/${seg(id)}/complete`, null, { params: { notes } }),
  exception: (kind: QueueKind, id: string, reason: string) =>
    api.post<unknown>(`/queues/${kind}/${seg(id)}/exception`, null, { params: { reason } }),
  vitals: (appointmentPublicId: string) => api.list<VitalsReading>(`/clinical/vitals/appointments/${seg(appointmentPublicId)}`),
  verifyVitals: (vitalsPublicId: string) => api.post<VitalsReading>(`/clinical/vitals/${seg(vitalsPublicId)}/verify`),
  doctorQueue: () => api.list<DoctorQueueRow>('/clinical/queues/doctor'),
  centreQueue: () => api.list<CentreDoctorRow>('/clinical/centre-consultations/mine'),
}

export type ConsultKind = 'fnph' | 'centre'

const roomBase = (kind: ConsultKind) => (kind === 'centre' ? '/centre-consultations' : '/consultations')

export const consultationApiFor = (kind: ConsultKind) => ({
  /** Creates the room on first call. A state change, never a retry target. */
  joinAsDoctor: (appointmentPublicId: string) => api.post<JoinResponse>(`${roomBase(kind)}/${seg(appointmentPublicId)}/join/doctor`),
  joinAsPatient: (appointmentPublicId: string) => api.post<JoinResponse>(`/consultations/${seg(appointmentPublicId)}/join/patient`),
  /** Centre staff attend with the patient; they are a participant, not the owner. */
  joinAsCentre: (appointmentPublicId: string) => api.post<JoinResponse>(`/centre-consultations/${seg(appointmentPublicId)}/join/centre`),
  confirmIdentity: (consultationPublicId: string) => api.post<void>(`${roomBase(kind)}/${seg(consultationPublicId)}/identity-confirmed`),
  switchModality: (consultationPublicId: string, modality: 'VIDEO' | 'AUDIO' | 'PHONE_FALLBACK', reason?: string) =>
    api.post<void>(`${roomBase(kind)}/${seg(consultationPublicId)}/modality`, null, { params: { modality, reason } }),
  terminate: (consultationPublicId: string, body: { reason: TerminationReason; note?: string; safetyAction: string }) =>
    api.post<void>(`${roomBase(kind)}/${seg(consultationPublicId)}/terminate`, body),
  /** FNPH consultations only. Fire and forget; a failed report must never disturb the session. */
  reportQuality: (consultationPublicId: string, role: 'DOCTOR' | 'PATIENT', metrics: { roundTripMs?: number; videoQuality?: string }) =>
    api.post<void>(`/consultations/${seg(consultationPublicId)}/quality`, null, { params: { role, ...metrics } }).catch(() => undefined),
})

export const consultationApi = consultationApiFor('fnph')



export const recordApiFor = (kind: ConsultKind) => {
  const root = kind === 'centre' ? '/clinical/centre-consultations' : '/clinical/consultations'
  const base = (id: string) => `${root}/${seg(id)}`
  return {
  summary: (consultationPublicId: string) => api.get<ConsultationSummary>(base(consultationPublicId)),
  record: (consultationPublicId: string) => api.get<ConsultationRecord>(`${base(consultationPublicId)}/record`),
  history: (consultationPublicId: string) => api.list<ClinicalNote>(`${base(consultationPublicId)}/note/history`),
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
}

export const recordApi = recordApiFor('fnph')

export type ReviewKind = 'pharmacy' | 'laboratory'

export const reviewApi = {
  /**
    Both queues return whatever is assigned to the caller; the server does not
    filter by type. Filtered here so each screen matches its title.
  */
  queue: async (kind: ReviewKind) => {
    const rows = await api.list<ReviewRow>(`/reviews/${kind}/queue`)
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
