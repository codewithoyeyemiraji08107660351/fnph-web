/*
  Shapes returned by fnph-telepsychiatric. Each type names the Java class it
  mirrors so a backend change can be traced here. Timestamps arrive as ISO
  strings; parse them with lib/format.ts, never with new Date() directly.
*/

export type IsoDateTime = string

/** handler/ErrorResponse */
export interface ErrorResponse {
  timestamp?: IsoDateTime
  status: number
  error?: string
  message?: string
  path?: string
  validationErrors?: Record<string, string>
}

/** session/api/LoginResponse */
export type LoginStatus = 'AUTHENTICATED' | 'MFA_REQUIRED' | 'MFA_ENROLMENT_REQUIRED'
export interface LoginResponse {
  status: LoginStatus
  accessToken?: string
  refreshToken?: string
  expiresInSeconds?: number
  mfaToken?: string
  mfaExpiresInSeconds?: number
  dashboardRoute?: string
  primaryRole?: string
  mustChangePassword?: boolean
  recoveryCodes?: string[]
}

/** session/api/MfaEnrolmentResponse */
export interface MfaEnrolmentResponse {
  secret: string
  provisioningUri: string
  recoveryCodes?: string[]
}

/** session/api/ActivationPreviewResponse */
export interface ActivationPreview {
  fullName: string
  email: string
  username: string
  expiresAt: IsoDateTime
  minimumPasswordLength: number
}

/** session/api/SessionResponse */
export interface SessionItem {
  publicId: string
  deviceLabel?: string
  ipAddress?: string
  userAgent?: string
  signedInAt: IsoDateTime
  lastSeenAt?: IsoDateTime
  expiresAt?: IsoDateTime
  current: boolean
}

export type PrincipalScope = 'FNPH' | 'PATIENT' | 'CENTRE'

/** authz/api/CurrentPrincipalResponse */
export interface Principal {
  publicId: string
  username: string
  displayName: string
  scope: PrincipalScope
  primaryRole: string
  dashboardRoute: string
  roles: string[]
  permissions: string[]
  centrePublicId?: string
  centreName?: string
  mfaEnabled: boolean
  mustChangePassword: boolean
}

/** SelfServiceController#profile (map) */
export interface OwnProfile {
  publicId: string
  username: string
  firstName?: string
  lastName?: string
  email?: string
  phoneNumber?: string
  mfaEnabled?: boolean
  mustChangePassword?: boolean
  lastLoginAt?: IsoDateTime
}

/** SelfServiceController#health (map) */
export interface SystemHealth {
  checkedAt: IsoDateTime
  activeStaffAccounts?: number
  enrolmentAvailable?: boolean
  [key: string]: unknown
}

/** PublicInfoController#settings */
export interface PublicSettings {
  clinical_emergency_number?: string
  helpdesk_email?: string
  consultation_fee_ngn?: string
  session_minutes_fnph?: string
  joining_grace_minutes?: string
  no_show_cutoff_minutes?: string
  cancellation_notice_hours?: string
  prescription_validity_days?: string
  session_inactivity_timeout_minutes?: string
}

/** notification/api/NotificationResponse */
export interface NotificationItem {
  publicId: string
  type: string
  subject: string
  body?: string
  actionUrl?: string
  entityType?: string
  entityId?: number
  sharedWithRole: boolean
  targetRole?: string
  read: boolean
  acknowledgedBy?: string
  createdAt: IsoDateTime
}

export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'

/** UserAdministrationController#toRow (map) */
export interface StaffUserRow {
  publicId: string
  username: string
  fullName: string
  email?: string
  phoneNumber?: string
  status: UserStatus
  mfaEnabled?: boolean
  accountLocked?: boolean
  failedLoginAttempts?: number
  lastLoginAt?: IsoDateTime
  roles: string[]
  [key: string]: unknown
}

/** user/api/CreateStaffUserRequest */
export interface CreateStaffUserRequest {
  username: string
  email: string
  firstName: string
  lastName: string
  phoneNumber?: string
  staffNumber?: string
  primaryRoleCode: string
  centrePublicId?: string
  reason: string
}

/** user/api/StaffUserResponse */
export interface StaffUserResponse {
  publicId: string
  username: string
  email: string
  fullName: string
  status: UserStatus
  primaryRoleCode: string
  primaryRoleName: string
  centrePublicId?: string
  centreName?: string
  mfaRequired: boolean
  invitedAt?: IsoDateTime
  invitedBy?: string
  invitationExpiresAt?: IsoDateTime
  activatedAt?: IsoDateTime
}

export type RoleScope = 'FNPH' | 'PATIENT' | 'CENTRE'

/** authz/api/RoleSummaryResponse */
export interface RoleSummary {
  code: string
  name: string
  description?: string
  scope: RoleScope
  dashboardRoute: string
  systemRole: boolean
  active: boolean
  permissionCount: number
}

/** authz/api/PermissionResponse */
export interface PermissionItem {
  code: string
  module: string
  description?: string
}

/** authz/api/RoleDetailResponse */
export interface RoleDetail {
  code: string
  name: string
  description?: string
  scope: RoleScope
  dashboardRoute: string
  permissionCount: number
  permissionsByModule: Record<string, PermissionItem[]>
}

/** authz/api/UserRoleAssignmentResponse */
export interface UserRoleAssignment {
  userPublicId: string
  username: string
  displayName: string
  primaryRole: string
  dashboardRoute: string
  roles: Array<{
    code: string
    name: string
    primary: boolean
    grantedAt?: IsoDateTime
    grantedBy?: string
    grantReason?: string
  }>
  effectivePermissions: string[]
}

/** supervision/api/ViewAsSessionResponse */
export interface ViewAsSession {
  publicId: string
  targetUserPublicId: string
  targetUsername: string
  targetFullName: string
  targetRole: string
  dashboardRoute: string
  reason: string
  startedAt: IsoDateTime
  expiresAt: IsoDateTime
  endedAt?: IsoDateTime
  actionsPerformed: number
  availablePermissions: string[]
}

/** audit/api/AuditEntryResponse */
export interface AuditEntry {
  publicId: string
  username?: string
  effectivePrincipal?: string
  viewAsSessionId?: number
  action: string
  entityType?: string
  entityId?: number
  details?: string
  reason?: string
  outcome?: string
  centreId?: number
  ipAddress?: string
  performedAt: IsoDateTime
  systemAction: boolean
}

/** audit/AuditChainVerifier.VerificationResult */
export interface AuditChainVerification {
  intact: boolean
  entriesChecked: number
  breaks: Array<{ entryId?: number; performedAt?: string; description: string }>
}

/** configuration/api/ConfigurationResponse */
export interface ConfigurationItem {
  key: string
  value: string
  valueType: 'STRING' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | string
  category: string
  description?: string
  minValue?: string
  maxValue?: string
  allowedValues?: string
  requiresGovernance: boolean
  effectiveFrom?: IsoDateTime
}

/** configuration/api/ConfigurationChangeResponse */
export interface ConfigurationChange {
  key: string
  previousValue?: string
  newValue: string
  reason: string
  changedBy: string
  changedAt: IsoDateTime
  effectiveFrom?: IsoDateTime
}

/** CentreAdminController#listCentres (map) */
export interface CentreRow {
  publicId: string
  code: string
  name: string
  lga?: string
  state?: string
  status: string
  isActive: boolean
  canReceiveReferrals: boolean
  suspendReason?: string
}

/** document/api/VerificationResponse */
export type DocumentVerificationStatus = 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUPERSEDED' | 'NOT_FOUND'
export interface DocumentVerification {
  status: DocumentVerificationStatus
  issueNumber?: string
  documentType?: string
  issuedOn?: string
  expiresOn?: string
}

/** Spring Data Page serialised by Boot 3.3 */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
  empty: boolean
}

/* ------------------------------------------------------------------
   Phase 2: FNPH patient pathway
   ------------------------------------------------------------------ */

export type Money = string | number

/** ehr/api/EnrolmentLookupResponse */
export interface EnrolmentLookup {
  verificationPublicId: string
  ehrNumber: string
  fullName: string
  dateOfBirthMasked?: string | null
  clinic?: string | null
  setupExpiresAt: IsoDateTime
  recordsAsAt: string
  recordsAgeInDays: number
}

/** TriageController#currentConsent */
export interface ConsentDocumentView {
  version: string
  title: string
  body: string
}

/** TriageController#questions */
export interface TriageQuestionSet {
  version: string
  questions: Array<{ publicId: string; sequence: number; questionText: string }>
}

/** TriageController#submit. Answers are YES or NO; the server knows which one stops. */
export interface TriageResult {
  publicId: string
  outcome: 'PROCEED' | 'STOPPED' | string
  mayProceed: boolean
  stopReason?: string
  escalation?: string
}

/** ScheduleDtos.AvailableTimeResponse */
export interface AvailableTime {
  startAt: IsoDateTime
  endAt: IsoDateTime
  slotPublicId: string
  remaining: number
}

export type AppointmentStatus =
  | 'SLOT_HELD' | 'EXPIRED' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED'
  | 'RESCHEDULED' | 'CANCELLED' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_SHOW'

/** ScheduleDtos.AppointmentResponse */
export interface Appointment {
  publicId: string
  reference: string
  status: AppointmentStatus
  appointmentDate: IsoDateTime
  scheduledEndAt: IsoDateTime
  heldUntil?: IsoDateTime
  room?: string
  joinWindowOpensAt?: IsoDateTime
  rejectedReason?: string
}

/** ScheduleDtos.HistoryResponse */
export interface AppointmentHistory {
  fromStatus?: string
  toStatus: string
  changedBy?: string
  changedAt: IsoDateTime
  reason?: string
}

/** payment/api/PaymentResponse */
export interface PaymentView {
  publicId: string
  reference: string
  rrr?: string | null
  paymentLink?: string | null
  status: string
  amount: string
  creditApplied: string
  payableAmount: string
  currency: string
  initiatedAt: string
  verifiedAt?: string | null
  expiresAt: string
  failureReason?: string | null
  amountMismatch: boolean
  usedForBooking: boolean
}

export interface RemitaCheckout {
  url: string
  merchantId: string
  rrr: string
  hash: string
  responseUrl: string
}

/** payment/api/CreditBalanceResponse */
export interface CreditBalance {
  balance: Money
  currency: string
}

/** VitalsController.VitalsRequest */
export interface VitalsInput {
  systolic?: number
  diastolic?: number
  heartRate?: number
  respiratoryRate?: number
  temperature?: number
  weightKg?: number
  heightCm?: number
  bloodOxygen?: number
  bloodGlucose?: number
  measuredAt?: string
  measurementSource?: string
  notes?: string
}

/** VitalsController.VitalsResponse */
export interface VitalsReading extends Omit<VitalsInput, 'measuredAt'> {
  publicId: string
  bmi?: number
  measuredAt: IsoDateTime
  verifiedAt?: IsoDateTime
  verifiedBy?: string
}

/** ApprovalController QueueResponse */
export interface ApprovalQueue {
  total: number
  appointments: Appointment[]
}

/** ScheduleDtos.ApproveAppointmentRequest. Field names differ from assign/team. */
export interface ApproveRequest {
  doctorPublicId: string
  roomPublicId: string
  nursePublicId?: string
  pharmacistPublicId?: string
  laboratoryTechnicianPublicId?: string
  himOfficerPublicId?: string
  notes?: string
}

/** RoomAvailabilityController#availability */
export interface DoctorAvailability {
  publicId: string
  doctorPublicId: string
  doctor: string
  startAt: IsoDateTime
  endAt: IsoDateTime
  available: boolean
  reason?: string
}

/** RoomAvailabilityController#rooms */
export interface RoomOption {
  publicId: string
  code: string
  name: string
  roomType: 'PATIENT_SERVICE' | 'CENTRE_CONSULTATION' | 'CONTINGENCY'
  capacityNotes?: string
}

/** ApprovalController#assignableStaff */
export interface StaffOption {
  publicId: string
  fullName: string
  roles: string[]
}

/** clinical/WorkQueueState */
export type WorkState = 'UNTREATED' | 'IN_PROGRESS' | 'TREATED' | 'EXCEPTION'

/** ClinicalReadController#queueFor */
export interface WorkQueueRow {
  appointmentPublicId: string
  reference: string
  appointmentDate: IsoDateTime
  room?: string
  patientName: string
  ehrNumber: string
  state: WorkState
  startedAt?: IsoDateTime
  completedAt?: IsoDateTime
  exceptionReason?: string
  vitalsRecorded: boolean
}

/** ClinicalReadController#doctorQueue */
export interface DoctorQueueRow {
  appointmentPublicId: string
  reference: string
  status: AppointmentStatus
  appointmentDate: IsoDateTime
  scheduledEndAt: IsoDateTime
  room?: string
  patientName: string
  ehrNumber: string
  nursingState: WorkState
  himState: WorkState
  vitalsRecorded: boolean
  /** Present once the room has been opened. */
  consultationPublicId?: string
}

/** consultation/api/JoinConsultationResponse */
export interface JoinResponse {
  consultationPublicId: string
  roomUrl: string
  token: string
  scheduledStart: IsoDateTime
  scheduledEnd: IsoDateTime
  remainingSeconds: number
  firstWarningMinutes: number
  secondWarningMinutes: number
  isOwner: boolean
}

export type TerminationReason =
  | 'FAILED_IDENTITY_VERIFICATION' | 'UNACCEPTABLE_PRIVACY' | 'PERSISTENT_DISRUPTION'
  | 'ABUSE' | 'EMERGENCY' | 'ACUTE_CLINICAL_UNSUITABILITY' | 'UNSAFE_CONNECTIVITY' | 'OTHER'

/** ClinicalDtos.NoteResponse */
export interface ClinicalNote {
  publicId: string
  version: number
  clinicalNote: string
  signedAt?: IsoDateTime
  signedBy?: string
  supersededAt?: IsoDateTime
  amendmentReason?: string
  followUpRecommendation?: string
  followUpTimeline?: string
}

/** ClinicalDtos.DocumentResponse */
export interface ClinicalDocument {
  publicId: string
  issueNumber?: string
  status: string
  issueDate: string
  expiryDate?: string
  itemCount: number
}

export interface PrescriptionItem {
  medication: string
  strength: string
  frequency: string
  duration: string
  instructions?: string
}

export interface InvestigationItem {
  panelName: string
  panelCode?: string
  notes?: string
}

export type ClinicalComponent = 'PRESCRIPTION' | 'INVESTIGATION' | 'FOLLOW_UP'

/** ClinicalReadController#prescriptionRow */
export interface PrescriptionDetail {
  publicId: string
  issueNumber?: string
  status: string
  issueDate: string
  expiryDate?: string
  clinicalInformation?: string
  items: PrescriptionItem[]
}

/** ClinicalReadController#investigationRow */
export interface InvestigationDetail {
  publicId: string
  issueNumber?: string
  status: string
  issueDate: string
  expiryDate?: string
  clinicalInformation?: string
  panels: Array<{ panelName: string; panelCode?: string }>
}

/** ReviewController#toQueue */
export interface ReviewRow {
  publicId: string
  reviewType: string
  assignedAt: IsoDateTime
  openedAt?: IsoDateTime
  submittedAt?: IsoDateTime
  queryRaised: boolean
  queryDetail?: string
  documentType: 'PRESCRIPTION' | 'INVESTIGATION'
  issueNumber?: string
  documentPublicId?: string
}

/** clinical/api/ReleaseBundleResponse */
export interface ReleaseBundle {
  publicId: string
  status: 'INCOMPLETE' | 'READY' | 'RELEASED' | 'BLOCKED'
  blockedReason?: string
  components: Array<{
    componentType: string
    complete: boolean
    notRequired: boolean
    notRequiredReason?: string
    outstanding: boolean
  }>
  releasedBy?: string
  releasedAt?: IsoDateTime
}

/** ReleaseController.ReleaseDeskRow */
export interface ReleaseDeskRow {
  publicId: string
  status: 'INCOMPLETE' | 'READY' | 'BLOCKED'
  blockedReason?: string
  createdAt: IsoDateTime
  appointmentPublicId: string
  appointmentReference: string
  appointmentDate: IsoDateTime
  patientName: string
  ehrNumber: string
  doctorName?: string
  outstanding: string[]
}

/** document/api/DocumentResponse */
export interface IssuedDocument {
  publicId: string
  issueNumber?: string
  documentType: string
  status: string
  issuedAt?: IsoDateTime
  expiresAt?: IsoDateTime
  downloadCount: number
  maxDownloads: number
  viewOnly: boolean
  verificationUrl?: string
  revokedReason?: string
}

/** ClinicalReadController#consultation */
export interface ConsultationSummary {
  publicId: string
  scheduledStartAt: IsoDateTime
  scheduledEndAt: IsoDateTime
  startedAt?: IsoDateTime
  endedAt?: IsoDateTime
  modality?: 'VIDEO' | 'AUDIO' | 'PHONE_FALLBACK'
  outcome?: string
  identityConfirmed?: boolean
  doctorJoinedAt?: IsoDateTime
  patientJoinedAt?: IsoDateTime
  terminationReason?: TerminationReason
  safetyActionTaken?: string
  /** Centre consultations only. */
  centreName?: string
  patientName?: string
  referralReason?: string
}

/** CentreClinicalController#mine */
export interface CentreDoctorRow {
  appointmentPublicId: string
  reference: string
  status: AppointmentStatus
  appointmentDate: IsoDateTime
  scheduledEndAt: IsoDateTime
  room?: string
  centreName: string
  patientName: string
  centrePatientId?: string
  referralReason?: string
  consultationPublicId?: string
}

export interface DocumentHeading {
  publicId: string
  issueNumber?: string
  status: string
  itemCount: number
  supersedesAnother: boolean
}

/** ClinicalReadController#consultationRecord */
export interface ConsultationRecord {
  consultationPublicId: string
  bundle: { publicId: string; status: string } | null
  components: Array<{ componentType: string; complete: boolean; notRequired: boolean; notRequiredReason?: string; settled: boolean }>
  prescriptions: DocumentHeading[]
  investigations: DocumentHeading[]
  followUps: Array<{ publicId: string; recommendation: string; reviewInterval?: string }>
}

/* ------------------------------------------------------------------
   Phase 3: Centres of Excellence
   ------------------------------------------------------------------ */

/** CentreReferralService.UtilisationSummary. Counts only, never amounts. */
export interface CentreUtilisation {
  referralsAwaitingScheduling: number
  referralsScheduled: number
  consultationsCompleted: number
  bundlesAwaitingAction: number
}

/** CentreAdminController#myCentre */
export interface CentreProfile {
  publicId: string
  code: string
  name: string
  lga?: string
  status: 'SETUP' | 'ACTIVE' | 'SUSPENDED'
  capabilities: Array<{ capability: 'PHARMACY' | 'LABORATORY' | 'HIM'; enabled: boolean }>
  utilisation: CentreUtilisation
}

/** CentreAdminController#myPatients */
export interface CentrePatientRow {
  publicId: string
  centrePatientId?: string
  name: string
  dateOfBirth: string
  phoneNumber: string
}

export interface RegisterCentrePatient {
  centrePatientId?: string
  firstName: string
  lastName: string
  middleName?: string
  dateOfBirth: string
  gender?: string
  phoneNumber: string
  email?: string
  address?: string
  fnphEhrNumber?: string
}

export type ReferralStatus = 'DRAFT' | 'SUBMITTED' | 'SCHEDULED' | 'RETURNED' | 'COMPLETED' | 'WITHDRAWN'

/** centre/api/CentreReferralResponse */
export interface CentreReferral {
  publicId: string
  reference: string
  centrePatientId?: string
  patientName: string
  status: ReferralStatus
  urgency: 'ROUTINE' | 'SOON'
  consentAcceptedAt?: IsoDateTime
  consentWitnessedBy?: string
  submittedAt?: IsoDateTime
  createdAt: IsoDateTime
}

export interface CreateReferral {
  centrePatientPublicId: string
  referralReason: string
  assessment?: string
  currentCondition?: string
  relevantMedicines?: string
  previousResults?: string
  urgency?: 'ROUTINE' | 'SOON'
}

/** CentreController#appointments */
export interface CentreAppointmentRow {
  publicId: string
  reference: string
  status: AppointmentStatus
  appointmentDate: IsoDateTime
  scheduledEndAt: IsoDateTime
  joinWindowOpensAt: IsoDateTime
  room?: string
  patientName: string
  centrePatientId?: string
  referralReference?: string
  /** Why FNPH returned the request, when it did. */
  returnedReason?: string
}

/** CentreController#toQueueItem */
export interface CentreBundleRow {
  publicId: string
  centrePatientId?: string
  patientName: string
  appointmentReference: string
  deliveredAt?: IsoDateTime
  firstOpenedAt?: IsoDateTime
  outstanding: boolean
}

/** CentreBookingController#centreQueue */
export interface CentreApprovalRow {
  publicId: string
  reference: string
  centre: string
  patient: string
  centrePatientId?: string
  appointmentDateTime: IsoDateTime
  referralReason?: string
}

/** TriageController#mine. Newest response is first. */
export interface TriageHistoryItem {
  publicId: string
  version: string
  outcome: 'PROCEED' | 'STOPPED' | string
  stopReason?: string
  escalation?: string
  submittedAt: IsoDateTime
}
