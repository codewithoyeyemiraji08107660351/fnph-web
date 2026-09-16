import { api, seg } from '../http'
import type {
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
  patients: (term?: string) => api.get<CentrePatientRow[]>('/centres/me/patients', { params: { term: term || undefined } }),
  /** JSON body. No FNPH record is looked up or linked. */
  registerPatient: (body: RegisterCentrePatient) => api.post<{ publicId: string; centrePatientId?: string; name: string }>('/centres/me/patients', body),
  /** Query parameters. Only contact details can change. */
  updatePatient: (publicId: string, fields: { phoneNumber?: string; email?: string; address?: string }) =>
    api.put<{ updated: boolean }>(`/centres/me/patients/${seg(publicId)}`, null, { params: fields }),
  patientReferrals: (patientPublicId: string) => api.get<CentreReferral[]>(`/centres/me/patients/${seg(patientPublicId)}/referrals`),
  referrals: (status?: ReferralStatus) => api.get<CentreReferral[]>('/centres/me/referrals', { params: { status } }),
  createReferral: (body: CreateReferral) => api.post<CentreReferral>('/centres/me/referrals', body),
  consent: () => api.get<ConsentDocumentView>('/consent/centre'),
  /** Query parameters. Consent is taken for every referral; nothing carries over. */
  submitReferral: (publicId: string, consentVersion: string, consentWitnessedBy: string) =>
    api.post<CentreReferral>(`/centres/me/referrals/${seg(publicId)}/submit`, null, { params: { consentVersion, consentWitnessedBy } }),
  /** Centre days are published separately from patient days. */
  times: (date: string) => api.get<Array<{ slotPublicId: string; startAt: string; endAt: string }>>('/centres/me/booking/times', { params: { date } }),
  requestAppointment: (referralPublicId: string, slotPublicId: string) =>
    api.post<{ publicId: string; reference: string; appointmentDate: string; status: string }>('/centres/me/booking/request', null, {
      params: { referralPublicId, slotPublicId },
    }),
  appointments: () => api.get<CentreAppointmentRow[]>('/centres/me/appointments'),
  incoming: () => api.get<CentreBundleRow[]>('/centres/me/incoming'),
  treated: () => api.get<CentreBundleRow[]>('/centres/me/treated'),
  markTreated: (receiptPublicId: string, notes: string) =>
    api.post<void>(`/centres/me/incoming/${seg(receiptPublicId)}/treated`, null, { params: { notes } }),
}

export const centreApprovalsApi = {
  queue: () => api.get<CentreApprovalRow[]>('/hub/centre-approvals'),
  /** Query parameters, and a third spelling of the team fields. No nurse on this pathway. */
  approve: (id: string, p: { doctorPublicId: string; roomPublicId: string; pharmacistPublicId?: string; laboratoryPublicId?: string; himPublicId?: string; notes?: string }) =>
    api.post<{ reference: string; status: string }>(`/hub/centre-approvals/${seg(id)}/approve`, null, { params: p }),
  /** Not a rejection: the referral goes back to the centre to act on. */
  returnToCentre: (id: string, reason: string) => api.post<unknown>(`/hub/centre-approvals/${seg(id)}/return`, null, { params: { reason } }),
}
