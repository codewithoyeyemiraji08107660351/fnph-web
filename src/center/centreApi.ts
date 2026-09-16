import { api } from '@/lib/api';

export interface CentreProfile {
  publicId: string
  code: string
  name: string
  lga: string | null
  status: 'SETUP' | 'ACTIVE' | 'SUSPENDED'
  /** Which optional services this centre runs. Drives route visibility. */
  capabilities: string[]
  utilisation: Utilisation
}

export interface Utilisation {
  referralsAwaitingScheduling: number
  referralsScheduled: number
  consultationsCompleted: number
  bundlesAwaitingAction: number
}

export interface CentrePatient {
  publicId: string
  centrePatientId: string
  firstName: string
  lastName: string
  dateOfBirth: string
  phoneNumber: string
  fnphEhrNumber: string | null
}

export interface RegisterPatientRequest {
  /** The centre's own identifier for this person, if it has one. */
  centrePatientId?: string
  firstName: string
  lastName: string
  middleName?: string
  /** Must be in the past. */
  dateOfBirth: string
  gender?: string
  phoneNumber: string
  email?: string
  address?: string
  /**
   * Optional and not a link. The offline hospital record is not retrieved or
   * joined, so this is a reference the clinician can quote, not a lookup.
   */
  fnphEhrNumber?: string
}

export interface Referral {
  publicId: string
  reference: string
  centrePatientId: string
  patientName: string
  /**
   * DRAFT has no appointment request, SCHEDULED has one, RETURNED means FNPH
   * asked the centre for something.
   */
  status: string
  urgency: string
  /** Consent for this referral only. Never carried over from an earlier one. */
  consentAcceptedAt: string | null
  consentWitnessedBy: string | null
  submittedAt: string | null
  createdAt: string
}

export interface CreateReferralRequest {
  centrePatientPublicId: string
  /**
   * At least 20 characters, and the minimum is the point: the offline FNPH
   * record is not retrieved, so this is the only clinical context the
   * consulting clinician gets.
   */
  referralReason: string
  assessment?: string
  currentCondition?: string
  relevantMedicines?: string
  previousResults?: string
  urgency?: 'ROUTINE' | 'SOON'
}

export interface IncomingBundle {
  publicId: string
  centrePatientId: string
  patientName: string
  appointmentReference: string
  deliveredAt: string
  firstOpenedAt: string | null
  outstanding: boolean
}

export const centreApi = {
  me() {
    return api.get<CentreProfile>('/centres/me').then((r) => r.data)
  },

  patients() {
    return api.get<CentrePatient[]>('/centres/me/patients').then((r) => r.data)
  },

  registerPatient(body: RegisterPatientRequest) {
    return api
      .post<Record<string, unknown>>('/centres/me/patients', body)
      .then((r) => r.data)
  },

  updatePatient(
    centrePatientPublicId: string,
    body: Partial<RegisterPatientRequest>,
  ) {
    return api
      .put<Record<string, unknown>>(
        `/centres/me/patients/${centrePatientPublicId}`,
        body,
      )
      .then((r) => r.data)
  },

  /** JSON body. One of the few on this pathway. */
  createReferral(body: CreateReferralRequest) {
    return api
      .post<Referral>('/centres/me/referrals', body)
      .then((r) => r.data)
  },

  /**
   * Query parameters. Records consent and makes the referral visible to FNPH.
   *
   * Consent is per referral and never inherited: agreeing to a consultation in
   * March is not agreeing to one in June. The witness is recorded because the
   * patient is in the room with centre staff, unlike the FNPH pathway where
   * they consent alone.
   */
  submitReferral(
    referralPublicId: string,
    consentVersion: string,
    consentWitnessedBy: string,
  ) {
    return api
      .post<Referral>(
        `/centres/me/referrals/${referralPublicId}/submit`,
        null,
        { params: { consentVersion, consentWitnessedBy } },
      )
      .then((r) => r.data)
  },

  /**
   * Only by patient. There is no endpoint listing a centre's referrals, so a
   * coordinator wanting everything in flight walks patient by patient. Raised
   * with the backend.
   */
  referralsFor(centrePatientPublicId: string) {
    return api
      .get<Referral[]>(
        `/centres/me/patients/${centrePatientPublicId}/referrals`,
      )
      .then((r) => r.data)
  },

  bookingTimes(date: string) {
    return api
      .get<
        { startAt: string; endAt: string; slotPublicId: string; remaining: number }[]
      >('/centres/me/booking/times', { params: { date } })
      .then((r) => r.data)
  },

  /** Query parameters. A request, not a hold: FNPH decides. */
  requestAppointment(referralPublicId: string, slotPublicId: string) {
    return api
      .post<Record<string, unknown>>('/centres/me/booking/request', null, {
        params: { referralPublicId, slotPublicId },
      })
      .then((r) => r.data)
  },

  incoming() {
    return api.get<IncomingBundle[]>('/centres/me/incoming').then((r) => r.data)
  },

  /**
   * notes is required: "treated" with no record leaves the centre nothing to
   * show when FNPH asks what was done.
   */
  markTreated(receiptPublicId: string, notes: string) {
    return api.post<void>(
      `/centres/me/incoming/${receiptPublicId}/treated`,
      null,
      { params: { notes } },
    )
  },

  utilisation() {
    return api.get<Utilisation>('/centres/me/utilisation').then((r) => r.data)
  },
}