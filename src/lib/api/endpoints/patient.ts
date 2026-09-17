import axios from 'axios'
import { api, http, seg } from '../http'
import type {
  Appointment,
  AppointmentHistory,
  AvailableTime,
  ConsentDocumentView,
  CreditBalance,
  EnrolmentLookup,
  IssuedDocument,
  PaymentView,
  TriageQuestionSet,
  TriageResult,
  VitalsInput,
  VitalsReading,
} from '../types'

const PUBLIC_ROOT = `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')}/api/v1`
const publicPost = <T>(url: string, body: unknown) => axios.post<T>(`${PUBLIC_ROOT}${url}`, body, { timeout: 30_000 }).then((r) => r.data)

/** Public, no token. Every failure answers the same way on purpose. */
export const enrolmentApi = {
  lookup: (body: { ehrNumber: string; dateOfBirth?: string; phoneLastFour?: string }) =>
    publicPost<EnrolmentLookup>('/enrolment/lookup', body),
  complete: (body: { verificationPublicId: string; code: string; password: string }) =>
    publicPost<void>('/enrolment/complete', body),
  help: (body: {
    ehrNumber: string
    fullName: string
    dateOfBirth?: string
    phoneNumber?: string
    email?: string
    preferredContact?: string
    supportingNote?: string
  }) => publicPost<Record<string, string>>('/enrolment/help', body),
}

export const carePathApi = {
  consent: () => api.get<ConsentDocumentView>('/consent/current'),
  acceptConsent: () => api.post<{ publicId: string; version: string; acceptedAt: string }>('/consent/accept'),
  questions: () => api.get<TriageQuestionSet>('/triage/questions'),
  submitTriage: (answers: Record<string, 'YES' | 'NO'>) => api.post<TriageResult>('/triage/responses', answers),
}

export const bookingApi = {
  times: (date: string) => api.list<AvailableTime>('/booking/times', { params: { date } }),
  /** 409 when the time went. The appointment may be on another room at the same time. */
  hold: (slotPublicId: string) => api.post<Appointment>('/booking/hold', { slotPublicId }),
  mine: () => api.list<Appointment>('/booking/mine'),
  history: (appointmentPublicId: string) => api.list<AppointmentHistory>(`/booking/${seg(appointmentPublicId)}/history`),
}

export const paymentApi = {
  /** Query parameters, not a body. */
  initiate: (contact: { email?: string; phone?: string }) =>
    api.post<PaymentView>('/payments/initiate', null, { params: contact }),
  /** Asks Remita. A return to this page is not evidence that money moved. */
  verify: (reference: string) => api.post<PaymentView>(`/payments/${seg(reference)}/verify`),
  mine: () => api.list<PaymentView>('/payments/mine'),
  credit: () => api.get<CreditBalance>('/payments/credit'),
}

export const patientVitalsApi = {
  submit: (appointmentPublicId: string, body: VitalsInput) =>
    api.post<VitalsReading>(`/clinical/vitals/appointments/${seg(appointmentPublicId)}`, body),
}

export const documentsApi = {
  mine: () => api.list<IssuedDocument>('/documents/mine'),
  /**
    The download itself. This request is the claim: the server counts it
    before sending the file, so nothing else may claim first. Never call it
    on page load or from a retry.
  */
  downloadFile: async (documentPublicId: string) => {
    const response = await http.get<Blob>(`/documents/${seg(documentPublicId)}/file`, { responseType: 'blob', timeout: 120_000 })
    const disposition = String(response.headers['content-disposition'] ?? '')
    const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `fnph-document-${documentPublicId}.pdf`
    return { blob: response.data, filename }
  },
  /** Authenticated image, so fetched rather than linked. Does not touch the allowance. */
  qr: (documentPublicId: string) =>
    http.get<Blob>(`/documents/${seg(documentPublicId)}/qr`, { responseType: 'blob' }).then((r) => r.data),
}

/** The patient's own prescriptions and requests, with their contents, for reading on screen. */
export const myRecordsApi = {
  prescriptions: () => api.list<import('../types').PrescriptionDetail>('/clinical/prescriptions/mine'),
  investigations: () => api.list<import('../types').InvestigationDetail>('/clinical/investigations/mine'),
}
