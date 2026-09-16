import type { PrincipalScope } from '@/lib/api/types'

export type Portal = 'patient' | 'core' | 'centre'

export interface NavItem {
  to: string
  label: string
  icon: string
  /** Shown only when the principal holds this permission. Visibility only; the API enforces access. */
  permission?: string
  end?: boolean
}

export interface RoleDefinition {
  code: string
  name: string
  portal: Portal
  /** Must match roles.dashboard_route in V5__role_permission_model.sql */
  route: string
  nav: NavItem[]
  /** What this workspace does, from the blueprint, shown until its phase ships. */
  responsibilities: string[]
  /** The phase that delivers this workspace. */
  phase: 2 | 3 | 4
  /** True once the workspace has real screens behind its route. */
  live: boolean
}

export const CENTRAL_ADMINISTRATOR = 'CENTRAL_ADMINISTRATOR'

export const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'System overview', icon: 'bi-grid-1x2', end: true },
  { to: '/admin/users', label: 'Users', icon: 'bi-people', permission: 'user.read' },
  { to: '/admin/roles', label: 'Roles and permissions', icon: 'bi-shield-lock', permission: 'role.read' },
  { to: '/admin/supervision', label: 'Supervised view', icon: 'bi-eye', permission: 'supervision.view_as' },
  { to: '/admin/audit', label: 'Audit log', icon: 'bi-journal-text', permission: 'audit.read' },
  { to: '/admin/configuration', label: 'Configuration', icon: 'bi-sliders', permission: 'config.read' },
  { to: '/admin/schedules', label: 'Consultation days', icon: 'bi-calendar-week', permission: 'schedule.read' },
  { to: '/admin/rooms', label: 'Rooms', icon: 'bi-door-open', permission: 'room.read' },
  { to: '/admin/rota', label: 'Doctor rota', icon: 'bi-person-badge', permission: 'doctor_availability.read' },
  { to: '/admin/centres', label: 'Centres', icon: 'bi-buildings', permission: 'centre.read' },
  { to: '/admin/exports', label: 'EHR exports', icon: 'bi-database', permission: 'ehr_import.read' },
  { to: '/admin/verification', label: 'Enrolment checks', icon: 'bi-person-check', permission: 'ehr_verification.resolve' },
  { to: '/admin/notifications', label: 'Notices', icon: 'bi-megaphone', permission: 'notification.send' },
  { to: '/admin/support', label: 'Support queue', icon: 'bi-headset', permission: 'ticket.read' },
  { to: '/admin/versions', label: 'Consent and safety questions', icon: 'bi-ui-checks', permission: 'consent.manage_versions' },
  { to: '/admin/appointments', label: 'Appointments by day', icon: 'bi-calendar3', permission: 'appointment.read' },
  { to: '/admin/cancellations', label: 'Cancellation requests', icon: 'bi-calendar-x', permission: 'appointment.read' },
  { to: '/admin/patients', label: 'Patients', icon: 'bi-person-vcard', permission: 'patient.read' },
  { to: '/admin/drift', label: 'Record mismatches', icon: 'bi-exclamation-diamond', permission: 'patient.flag_drift' },
  { to: '/admin/codes', label: 'Enrolment desk', icon: 'bi-hourglass-split', permission: 'enrolment.release_code' },
  { to: '/admin/documents', label: 'Issued documents', icon: 'bi-file-earmark-check', permission: 'document.read' },
]

const workspace = (route: string, label: string, icon: string): NavItem[] => [{ to: route, label, icon, end: true }]

export const ROLES: RoleDefinition[] = [
  {
    code: 'HUB_COORDINATOR', name: 'Hub Coordinator', portal: 'core', route: '/hub', phase: 2, live: true,
    nav: [
      { to: '/hub/approvals', label: 'Approvals', icon: 'bi-inbox', permission: 'appointment.read' },
      { to: '/hub/centre-approvals', label: 'Centre requests', icon: 'bi-buildings', permission: 'appointment.read' },
      { to: '/hub/releases', label: 'Release desk', icon: 'bi-send-check', permission: 'release_bundle.read' },
      { to: '/hub/queries', label: 'Review queries', icon: 'bi-chat-square-text', permission: 'review.read' },
      { to: '/hub/today', label: 'Appointments by day', icon: 'bi-calendar3', permission: 'appointment.read' },
      { to: '/hub/cancellations', label: 'Cancellation requests', icon: 'bi-calendar-x', permission: 'appointment.read' },
      { to: '/hub/patients', label: 'Patients', icon: 'bi-person-vcard', permission: 'patient.read' },
      { to: '/hub/codes', label: 'Enrolment desk', icon: 'bi-hourglass-split', permission: 'enrolment.release_code' },
      { to: '/hub/documents', label: 'Issued documents', icon: 'bi-file-earmark-check', permission: 'document.read' },
    ],
    responsibilities: [
      'Approve or reject booking requests and assign room, doctor and team',
      'Oversee live sessions, cancellations, reschedules and no-shows',
      'Run the completeness check and release clinical bundles',
    ],
  },
  {
    code: 'DOCTOR', name: 'Doctor', portal: 'core', route: '/clinical', phase: 2, live: true,
    nav: workspace('/clinical', 'My consultations', 'bi-camera-video'),
    responsibilities: [
      'Pre-review assigned appointments, vitals and uploaded results',
      'Run the 30-minute video consultation with controlled audio fallback',
      'Record optional notes, prescriptions, investigations and follow-up',
    ],
  },
  {
    code: 'PHARMACIST', name: 'Pharmacist', portal: 'core', route: '/reviews/pharmacy', phase: 2, live: true,
    nav: [
      { to: '/reviews/pharmacy', label: 'Pharmacy reviews', icon: 'bi-capsule', end: true },
      { to: '/reviews/pharmacy/documents', label: 'Check a document', icon: 'bi-file-earmark-check', permission: 'document.read' },
    ],
    responsibilities: ['Transcribe and verify prescriptions from the offline EHR', 'Submit reviewed prescriptions to the Hub Coordinator'],
  },
  {
    code: 'LABORATORY_TECHNICIAN', name: 'Laboratory Technician', portal: 'core', route: '/reviews/laboratory', phase: 2, live: true,
    nav: [
      { to: '/reviews/laboratory', label: 'Laboratory reviews', icon: 'bi-droplet-half', end: true },
      { to: '/reviews/laboratory/documents', label: 'Check a document', icon: 'bi-file-earmark-check', permission: 'document.read' },
    ],
    responsibilities: ['Transcribe and review investigation requests', 'Submit reviewed requests to the Hub Coordinator'],
  },
  {
    code: 'NURSING', name: 'Nurse', portal: 'core', route: '/queues/nursing', phase: 2, live: true,
    nav: workspace('/queues/nursing', 'Nursing queue', 'bi-heart-pulse'),
    responsibilities: ['Enter patient-submitted vitals in the offline EHR', 'Assign the matching room and mark preparation complete'],
  },
  {
    code: 'HIM', name: 'Health Information Management', portal: 'core', route: '/queues/him', phase: 2, live: true,
    nav: [
      { to: '/queues/him', label: 'Records queue', icon: 'bi-folder2-open', end: true, permission: 'queue.him' },
      { to: '/queues/him/verification', label: 'Enrolment checks', icon: 'bi-person-check', permission: 'ehr_verification.resolve' },
      { to: '/queues/him/exports', label: 'EHR exports', icon: 'bi-database', permission: 'ehr_import.read' },
      { to: '/queues/him/patients', label: 'Patients', icon: 'bi-person-vcard', permission: 'patient.read' },
      { to: '/queues/him/drift', label: 'Record mismatches', icon: 'bi-exclamation-diamond', permission: 'patient.flag_drift' },
      { to: '/queues/him/codes', label: 'Enrolment desk', icon: 'bi-hourglass-split', permission: 'enrolment.release_code' },
      { to: '/queues/him/documents', label: 'Issued documents', icon: 'bi-file-earmark-check', permission: 'document.read' },
    ],
    responsibilities: ['Retrieve or prepare the offline record by EHR number', 'Mark record tasks treated and handle verification requests'],
  },
  {
    code: 'FINANCE', name: 'Finance Officer', portal: 'core', route: '/finance', phase: 4, live: true,
    nav: [
      { to: '/finance', label: 'Overview', icon: 'bi-cash-coin', end: true },
      { to: '/finance/wallets', label: 'Centre wallets', icon: 'bi-wallet2', permission: 'wallet.read_balance' },
      { to: '/finance/payments', label: 'Patient payments', icon: 'bi-receipt', permission: 'payment.read' },
      { to: '/finance/reconciliation', label: 'Reconciliation', icon: 'bi-arrow-left-right', permission: 'payment.reconcile' },
      { to: '/finance/reports', label: 'Reports', icon: 'bi-bar-chart', permission: 'finance_report.read' },
      { to: '/finance/patients', label: 'Payments by patient', icon: 'bi-person-vcard', permission: 'patient.read' },
    ],
    responsibilities: [
      'Monitor verified Remita results and reconcile payments',
      'Fund Centre wallets and act on low-balance alerts',
      'Produce daily, monthly, exception and reversal reports',
    ],
  },
  {
    code: 'ICT_SUPPORT', name: 'ICT Support', portal: 'core', route: '/ict', phase: 4, live: true,
    nav: [
      { to: '/ict', label: 'EHR exports', icon: 'bi-database', end: true, permission: 'ehr_import.read' },
      { to: '/ict/verification', label: 'Enrolment checks', icon: 'bi-person-check', permission: 'ehr_verification.resolve' },
      { to: '/ict/support', label: 'Support queue', icon: 'bi-headset', permission: 'ticket.read' },
      { to: '/ict/quarantine', label: 'Quarantined uploads', icon: 'bi-shield-exclamation', permission: 'upload.quarantine' },
    ],
    responsibilities: ['Handle technical support and EHR verification exceptions', 'Monitor service health. No clinical access.'],
  },
  {
    code: 'HELPDESK', name: 'Helpdesk Agent', portal: 'core', route: '/helpdesk', phase: 4, live: true,
    nav: [
      { to: '/helpdesk', label: 'Support queue', icon: 'bi-headset', end: true },
      { to: '/helpdesk/codes', label: 'Enrolment desk', icon: 'bi-hourglass-split', permission: 'enrolment.release_code' },
    ],
    responsibilities: ['Answer and escalate support tickets', 'No clinical or financial access'],
  },
  {
    code: 'PATIENT', name: 'Patient', portal: 'patient', route: '/portal', phase: 2, live: true,
    nav: [
      { to: '/portal', label: 'My care', icon: 'bi-house-heart', end: true },
      { to: '/portal/booking', label: 'Book a consultation', icon: 'bi-calendar-plus' },
      { to: '/portal/appointments', label: 'Appointments', icon: 'bi-calendar-check' },
      { to: '/portal/documents', label: 'Documents', icon: 'bi-file-earmark-medical' },
    ],
    responsibilities: [
      'Complete triage, consent and mandatory vitals',
      'Pay the consultation fee through Remita and choose a 30-minute slot',
      'Join the video consultation and collect released documents',
    ],
  },
  {
    code: 'CENTRE_HUB_COORDINATOR', name: 'Centre Hub Coordinator', portal: 'centre', route: '/centre', phase: 3, live: true,
    nav: [
      { to: '/centre', label: 'Overview', icon: 'bi-building', end: true },
      { to: '/centre/patients', label: 'Patients', icon: 'bi-people', permission: 'centre_patient.read' },
      { to: '/centre/referrals', label: 'Referrals', icon: 'bi-send', permission: 'centre_referral.read' },
      { to: '/centre/consultations', label: 'Consultations', icon: 'bi-camera-video', permission: 'centre_referral.read' },
      { to: '/centre/incoming', label: 'Care bundles', icon: 'bi-inbox', permission: 'centre_bundle.read' },
    ],
    responsibilities: [
      'Register centre patients and submit referrals with vitals and uploads',
      'Request consultation slots and join hub-to-hub video sessions',
      'Act on released care bundles and mark them treated',
    ],
  },
  {
    code: 'CENTRE_ASSISTANT_COORDINATOR', name: 'Assistant Centre Coordinator', portal: 'centre', route: '/centre', phase: 3, live: true,
    nav: [
      { to: '/centre', label: 'Overview', icon: 'bi-building', end: true },
      { to: '/centre/patients', label: 'Patients', icon: 'bi-people', permission: 'centre_patient.read' },
      { to: '/centre/referrals', label: 'Referrals', icon: 'bi-send', permission: 'centre_referral.read' },
      { to: '/centre/consultations', label: 'Consultations', icon: 'bi-camera-video', permission: 'centre_referral.read' },
      { to: '/centre/incoming', label: 'Care bundles', icon: 'bi-inbox', permission: 'centre_bundle.read' },
    ],
    responsibilities: ['Support the Centre Hub Coordinator with reduced privileges'],
  },
  {
    code: 'CENTRE_PHARMACY', name: 'Centre Pharmacist', portal: 'centre', route: '/centre/pharmacy', phase: 3, live: true,
    nav: workspace('/centre/pharmacy', 'Centre pharmacy', 'bi-capsule'),
    responsibilities: ['Handle released prescriptions locally, once activated for the centre'],
  },
  {
    code: 'CENTRE_LABORATORY', name: 'Centre Laboratory', portal: 'centre', route: '/centre/laboratory', phase: 3, live: true,
    nav: workspace('/centre/laboratory', 'Centre laboratory', 'bi-droplet-half'),
    responsibilities: ['Handle released investigation requests locally, once activated for the centre'],
  },
  {
    code: 'CENTRE_HIM', name: 'Centre HIM', portal: 'centre', route: '/centre/him', phase: 3, live: true,
    nav: [
      { to: '/centre/him', label: 'Centre records', icon: 'bi-folder2-open', end: true },
      { to: '/centre/patients', label: 'Patients', icon: 'bi-people', permission: 'centre_patient.read' },
    ],
    responsibilities: ['Handle centre patient records locally, once activated for the centre'],
  },
]

export const ROLE_BY_CODE: Record<string, RoleDefinition> = Object.fromEntries(ROLES.map((r) => [r.code, r]))

export function roleName(code?: string | null): string {
  if (!code) return ''
  if (code === CENTRAL_ADMINISTRATOR) return 'Central Administrator'
  return ROLE_BY_CODE[code]?.name ?? code
}

export function portalForScope(scope?: PrincipalScope | null): Portal {
  if (scope === 'PATIENT') return 'patient'
  if (scope === 'CENTRE') return 'centre'
  return 'core'
}

export const PORTAL_LABEL: Record<Portal, string> = {
  patient: 'Patient portal',
  core: 'Core Engine',
  centre: 'Centre of Excellence',
}

/**
  Only a relative, known dashboard path is followed after sign-in. A value that
  is not one of ours falls back to the root rather than becoming an open redirect.
*/
const KNOWN_ROUTES = new Set(['/admin', ...ROLES.map((r) => r.route)])
export function safeDashboardRoute(route?: string | null): string {
  if (route && route.startsWith('/') && !route.startsWith('//') && KNOWN_ROUTES.has(route)) return route
  return '/'
}
