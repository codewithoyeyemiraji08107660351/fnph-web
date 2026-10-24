import { api, seg } from '../http'
import type {
  CentreBundleDetail,
  CentreCapability,
  CentreVitalsInput,
  CentreVitalsReading,
  CentreApprovalRow,
  CentreAppointmentRow,
  CentreBundleRow,
  CentrePatientRow,
  CentreProfile,
  CentreReferral,
  CentreUtilisation,
  ConsentDocumentView,
  CreateReferral,
  ReferralStatus,
  RegisterCentrePatient,
} from '../types'

export const centreApi = {
  me: () => api.get<CentreProfile>('/centres/me'),
  utilisation: () => api.get<CentreUtilisation>('/centres/me/utilisation'),
  patients: (term?: string) => api.list<CentrePatientRow>('/centres/me/patients', { params: { term: term || undefined } }),
  /** JSON body. No FNPH record is looked up or linked. */
  registerPatient: (body: RegisterCentrePatient) => api.post<{ publicId: string; centrePatientId?: string; name: string }>('/centres/me/patients', body),
  /** Query parameters. Only contact details can change. */
  updatePatient: (publicId: string, fields: { phoneNumber?: string; email?: string; address?: string }) =>
    api.put<{ updated: boolean }>(`/centres/me/patients/${seg(publicId)}`, null, { params: fields }),
  patientReferrals: (patientPublicId: string) => api.list<CentreReferral>(`/centres/me/patients/${seg(patientPublicId)}/referrals`),
  referrals: (status?: ReferralStatus) => api.list<CentreReferral>('/centres/me/referrals', { params: { status } }),
  createReferral: (body: CreateReferral) => api.post<CentreReferral>('/centres/me/referrals', body),
  consent: () => api.get<ConsentDocumentView>('/consent/centre'),
  /** Query parameters. Consent is taken for every referral; nothing carries over. */
  /** Draft or returned only. Send it again with consent afterwards. */
  updateReferral: (publicId: string, body: Omit<CreateReferral, 'centrePatientPublicId'>) =>
    api.put<CentreReferral>(`/centres/me/referrals/${seg(publicId)}`, body),
  submitReferral: (publicId: string, consentVersion: string, consentWitnessedBy: string) =>
    api.post<CentreReferral>(`/centres/me/referrals/${seg(publicId)}/submit`, null, { params: { consentVersion, consentWitnessedBy } }),
  /** Centre days are published separately from patient days. */
  times: (date: string) => api.list<{ slotPublicId: string; startAt: string; endAt: string }>('/centres/me/booking/times', { params: { date } }),
  requestAppointment: (referralPublicId: string, slotPublicId: string) =>
    api.post<{ publicId: string; reference: string; appointmentDate: string; status: string }>('/centres/me/booking/request', null, {
      params: { referralPublicId, slotPublicId },
    }),
  appointments: () => api.list<CentreAppointmentRow>('/centres/me/appointments'),
  /** Before the start only. The referral reopens so another time can be requested. */
  cancelAppointment: (publicId: string, reason: string) =>
    api.post<{ reference: string; status: string }>(`/centres/me/appointments/${seg(publicId)}/cancel`, null, { params: { reason } }),
  /** One service's queue. Each service records its own action, so one finishing does not clear the others. */
  incoming: (capability: CentreCapability = 'COORDINATION') =>
    api.list<CentreBundleRow>('/centres/me/incoming', { params: { capability } }),
  treated: (capability: CentreCapability = 'COORDINATION') =>
    api.list<CentreBundleRow>('/centres/me/treated', { params: { capability } }),
  /** Contents of one delivered bundle. The first call records who opened it. */
  incomingItem: (receiptPublicId: string) => api.get<CentreBundleDetail>(`/centres/me/incoming/${seg(receiptPublicId)}`),
  markTreated: (receiptPublicId: string, notes: string, capability: CentreCapability = 'COORDINATION') =>
    api.post<void>(`/centres/me/incoming/${seg(receiptPublicId)}/treated`, null, { params: { notes, capability } }),
  vitals: (appointmentPublicId: string) => api.list<CentreVitalsReading>(`/centres/me/appointments/${seg(appointmentPublicId)}/vitals`),
  recordVitals: (appointmentPublicId: string, body: CentreVitalsInput) =>
    api.post<CentreVitalsReading>(`/centres/me/appointments/${seg(appointmentPublicId)}/vitals`, body),
}

/** The server caps a page at 200. The default of 50 hid requests past the fiftieth. */
export const CENTRE_QUEUE_SIZE = 200

export const centreApprovalsApi = {
  /** Pending requests by default; APPROVED lists confirmed consultations still to come. */
  queue: (status: 'AWAITING_APPROVAL' | 'APPROVED' = 'AWAITING_APPROVAL') =>
    api.list<CentreApprovalRow>('/hub/centre-approvals', { params: { status, size: CENTRE_QUEUE_SIZE } }),
  /** Before the start only. Returns the wallet charge when the booking was approved. */
  cancel: (id: string, reason: string) =>
    api.post<{ reference: string; status: string; walletRefunded: boolean }>(`/hub/centre-appointments/${seg(id)}/cancel`, null, { params: { reason } }),
  /** Query parameters, and a third spelling of the team fields. No nurse on this pathway. */
  approve: (id: string, p: { doctorPublicId: string; roomPublicId: string; pharmacistPublicId?: string; laboratoryPublicId?: string; himPublicId?: string; notes?: string }) =>
    api.post<{ reference: string; status: string }>(`/hub/centre-approvals/${seg(id)}/approve`, null, { params: p }),
  /** Not a rejection: the referral goes back to the centre to act on. */
  returnToCentre: (id: string, reason: string) => api.post<unknown>(`/hub/centre-approvals/${seg(id)}/return`, null, { params: { reason } }),
}
