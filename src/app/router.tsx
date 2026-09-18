import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { TicketLink } from '@/components/layout/TicketLink'
import { RouteError } from '@/components/layout/RouteError'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth, RequirePermission, RequireRole, DashboardRedirect } from '@/lib/auth/guards'
import { CENTRAL_ADMINISTRATOR, ROLES } from '@/lib/auth/roles'
import { Landing } from '@/pages/public/Landing'
import { PatientConsent } from '@/features/patient/PatientConsent'
import { PatientProfile } from '@/features/patient/PatientProfile'
import { PatientEntrance } from '@/pages/public/PatientEntrance'
import { StaffEntrance } from '@/pages/public/StaffEntrance'
import { CentreEntrance } from '@/pages/public/CentreEntrance'
import { Help } from '@/pages/public/Help'
import { VerifyDocument } from '@/pages/public/VerifyDocument'
import { Enrol } from '@/pages/public/Enrol'
import { NotFound } from '@/pages/public/NotFound'
import { Activate } from '@/pages/auth/Activate'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { Account } from '@/pages/account/Account'
import { ForcedPasswordChange } from '@/pages/account/ForcedPasswordChange'
import { WorkspacePending } from '@/pages/workspace/WorkspacePending'

import { Audit, Configuration, Overview, RoleDetail, Roles, Supervision, UserDetail, Users } from './adminPages'
import {
  Appointments,
  Approvals,
  BookingFlow,
  ConsultationRecordPage,
  DoctorRoom,
  DoctorWorklist,
  Documents,
  PatientRoom,
  PaymentReturn,
  PortalHome,
  ReleaseBundleView,
  ReleaseDesk,
  ReviewQueries,
  ReviewQueue,
  WorkQueue,
  CentreHome,
  CentrePatients,
  CentrePatientDetail,
  CentreReferrals,
  CentreConsultations,
  CentreIncoming,
  CentreRoom,
  CapabilityWorkspace,
  CentreApprovals,
  Schedules,
  Rooms,
  Rota,
  AdminCentres,
  AdminNotifications,
  FinanceOverview,
  Wallets,
  Payments,
  Reconciliation,
  Reports,
  EhrImports,
  VerificationQueue,
  Quarantine,
  SupportQueue,
  MySupport,
  DocumentsAdmin,
  HubToday,
  Cancellations,
  PatientRecords,
  Drift,
  PendingCodes,
} from './phase2Pages'

// Holding routes for workspaces whose phase has not shipped. One route per
// distinct dashboard path; roles that share a path share the route.
const workspaceRoutes = Object.values(
  ROLES.filter((r) => !r.live).reduce<Record<string, string[]>>((acc, r) => {
    ;(acc[r.route] ??= []).push(r.code)
    return acc
  }, {}),
).map((codes) => {
  const route = ROLES.find((r) => r.code === codes[0])!.route
  return {
    path: `${route.slice(1)}/*`,
    element: (
      <RequireRole roles={codes}>
        <WorkspacePending roles={codes} />
      </RequireRole>
    ),
  }
})

const admin = (permission: string | null, element: React.ReactNode) =>
  permission ? <RequirePermission permission={permission}>{element}</RequirePermission> : element
const gated = admin

const workspace = (roles: string[], children: Parameters<typeof createBrowserRouter>[0], path: string) => ({
  path,
  element: (
    <RequireRole roles={roles}>
      <Outlet />
    </RequireRole>
  ),
  children,
})

const CENTRE_ROLES = ['CENTRE_HUB_COORDINATOR', 'CENTRE_ASSISTANT_COORDINATOR', 'CENTRE_PHARMACY', 'CENTRE_LABORATORY', 'CENTRE_HIM']

const phase2Routes = [
  workspace(['PATIENT'], [
    { index: true, element: <PortalHome /> },
    { path: 'consent', element: <PatientConsent /> },
    { path: 'profile', element: <PatientProfile /> },
    { path: 'booking', element: gated('slot.hold', <BookingFlow />) },
    { path: 'payment', element: <PaymentReturn /> },
    { path: 'payment/return', element: <PaymentReturn /> },
    { path: 'appointments', element: <Appointments /> },
    { path: 'appointments/:appointmentId', element: <Appointments /> },
    { path: 'documents', element: gated('document.read_own', <Documents />) },
    { path: 'consultations/:appointmentId', element: gated('consultation.join_as_patient', <PatientRoom />) },
    { path: '*', element: <Navigate to="/portal" replace /> },
  ], 'portal'),
  workspace(['HUB_COORDINATOR'], [
    { index: true, element: <Navigate to="/hub/approvals" replace /> },
    { path: 'approvals', element: gated('appointment.read', <Approvals />) },
    { path: 'approvals/:appointmentId', element: gated('appointment.read', <Approvals />) },
    { path: 'releases', element: gated('release_bundle.read', <ReleaseDesk />) },
    { path: 'releases/:bundleId', element: gated('release_bundle.read', <ReleaseBundleView />) },
    { path: 'queries', element: gated('review.read', <ReviewQueries />) },
    { path: 'centre-approvals', element: gated('appointment.read', <CentreApprovals />) },
    { path: 'centre-approvals/:appointmentId', element: gated('appointment.read', <CentreApprovals />) },
    { path: 'today', element: gated('appointment.read', <HubToday />) },
    { path: 'cancellations', element: gated('appointment.read', <Cancellations />) },
    { path: 'cancellations/:requestId', element: gated('appointment.read', <Cancellations />) },
    { path: 'patients', element: gated('patient.read', <PatientRecords />) },
    { path: 'codes', element: gated('enrolment.release_code', <PendingCodes />) },
    { path: 'documents', element: gated('document.read', <DocumentsAdmin />) },
    { path: '*', element: <Navigate to="/hub" replace /> },
  ], 'hub'),
  workspace(['DOCTOR'], [
    { index: true, element: gated('consultation.read', <DoctorWorklist />) },
    { path: 'appointments/:appointmentId', element: gated('consultation.join_as_doctor', <DoctorRoom />) },
    { path: 'consultations/:consultationId', element: gated('clinical_note.read', <ConsultationRecordPage />) },
    { path: 'centre/:appointmentId', element: gated('consultation.join_as_doctor', <DoctorRoom kind="centre" />) },
    { path: 'centre-consultations/:consultationId', element: gated('clinical_note.read', <ConsultationRecordPage kind="centre" />) },
    { path: '*', element: <Navigate to="/clinical" replace /> },
  ], 'clinical'),
  workspace(['PHARMACIST'], [
    { index: true, element: gated('review.pharmacy', <ReviewQueue kind="pharmacy" />) },
    { path: 'documents', element: gated('document.read', <DocumentsAdmin />) },
  ], 'reviews/pharmacy'),
  workspace(['LABORATORY_TECHNICIAN'], [
    { index: true, element: gated('review.laboratory', <ReviewQueue kind="laboratory" />) },
    { path: 'documents', element: gated('document.read', <DocumentsAdmin />) },
  ], 'reviews/laboratory'),
  workspace(['NURSING'], [{ index: true, element: gated('queue.nursing', <WorkQueue kind="nursing" />) }], 'queues/nursing'),
  workspace(['HIM'], [
    { index: true, element: gated('queue.him', <WorkQueue kind="him" />) },
    { path: 'verification', element: gated('ehr_verification.resolve', <VerificationQueue />) },
    { path: 'exports', element: gated('ehr_import.read', <EhrImports />) },
    { path: 'patients', element: gated('patient.read', <PatientRecords />) },
    { path: 'drift', element: gated('patient.flag_drift', <Drift />) },
    { path: 'codes', element: gated('enrolment.release_code', <PendingCodes />) },
    { path: 'documents', element: gated('document.read', <DocumentsAdmin />) },
  ], 'queues/him'),
  workspace(CENTRE_ROLES, [
    { index: true, element: gated('centre.read_own', <CentreHome />) },
    { path: 'patients', element: gated('centre_patient.read', <CentrePatients />) },
    { path: 'patients/:patientId', element: gated('centre_patient.read', <CentrePatientDetail />) },
    { path: 'referrals', element: gated('centre_referral.read', <CentreReferrals />) },
    { path: 'consultations', element: gated('centre_referral.read', <CentreConsultations />) },
    { path: 'consultations/:appointmentId', element: gated('consultation.join_as_centre', <CentreRoom />) },
    { path: 'incoming', element: gated('centre_bundle.read', <CentreIncoming />) },
    { path: 'pharmacy', element: gated('centre_bundle.read', <CapabilityWorkspace capability="PHARMACY" />) },
    { path: 'laboratory', element: gated('centre_bundle.read', <CapabilityWorkspace capability="LABORATORY" />) },
    { path: 'him', element: gated('centre_bundle.read', <CapabilityWorkspace capability="HIM" />) },
    { path: '*', element: <Navigate to="/centre" replace /> },
  ], 'centre'),
  workspace(['FINANCE'], [
    { index: true, element: gated('finance_report.read', <FinanceOverview />) },
    { path: 'wallets', element: gated('wallet.read_balance', <Wallets />) },
    { path: 'payments', element: gated('payment.read', <Payments />) },
    { path: 'reconciliation', element: gated('payment.reconcile', <Reconciliation />) },
    { path: 'reports', element: gated('finance_report.read', <Reports />) },
    { path: 'patients', element: gated('patient.read', <PatientRecords />) },
    { path: '*', element: <Navigate to="/finance" replace /> },
  ], 'finance'),
  workspace(['ICT_SUPPORT'], [
    { index: true, element: gated('ehr_import.read', <EhrImports />) },
    { path: 'verification', element: gated('ehr_verification.resolve', <VerificationQueue />) },
    { path: 'support', element: gated('ticket.read', <SupportQueue />) },
    { path: 'quarantine', element: gated('upload.quarantine', <Quarantine />) },
    { path: '*', element: <Navigate to="/ict" replace /> },
  ], 'ict'),
  workspace(['HELPDESK'], [
    { index: true, element: gated('ticket.read', <SupportQueue />) },
    { path: 'codes', element: gated('enrolment.release_code', <PendingCodes />) },
  ], 'helpdesk'),
  // Every role that can raise a ticket. Escalation notices link to /tickets/{id}.
  { path: 'support', element: gated('ticket.create', <MySupport />) },
  { path: 'tickets/*', element: <TicketLink /> },
]

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <Landing /> },
          { path: 'patients', element: <PatientEntrance /> },
          { path: 'staff', element: <StaffEntrance /> },
          { path: 'centres', element: <CentreEntrance /> },
          { path: 'sign-in', element: <StaffEntrance /> },
          { path: 'help', element: <Help /> },
          { path: 'enrol', element: <Enrol /> },
          { path: 'verify', element: <VerifyDocument /> },
          { path: 'verify/:token', element: <VerifyDocument /> },
          { path: 'activate', element: <Activate /> },
          { path: 'forgot-password', element: <ForgotPassword /> },
          { path: 'reset-password', element: <ResetPassword /> },
          { path: '*', element: <NotFound /> },
        ],
      },
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { path: 'home', element: <DashboardRedirect /> },
          { path: 'account', element: <Account /> },
          { path: 'account/password', element: <ForcedPasswordChange /> },
          {
            path: 'admin',
            element: (
              <RequireRole roles={[CENTRAL_ADMINISTRATOR]}>
                <Outlet />
              </RequireRole>
            ),
            children: [
              { index: true, element: <Overview /> },
              { path: 'users', element: admin('user.read', <Users />) },
              { path: 'users/:userId', element: admin('user.read', <UserDetail />) },
              { path: 'roles', element: admin('role.read', <Roles />) },
              { path: 'roles/:code', element: admin('role.read', <RoleDetail />) },
              { path: 'supervision', element: admin('supervision.view_as', <Supervision />) },
              { path: 'audit', element: admin('audit.read', <Audit />) },
              { path: 'configuration', element: admin('config.read', <Configuration />) },
              { path: 'schedules', element: admin('schedule.read', <Schedules />) },
              { path: 'rooms', element: admin('room.read', <Rooms />) },
              { path: 'rota', element: admin('doctor_availability.read', <Rota />) },
              { path: 'centres', element: admin('centre.read', <AdminCentres />) },
              { path: 'exports', element: admin('ehr_import.read', <EhrImports />) },
              { path: 'verification', element: admin('ehr_verification.resolve', <VerificationQueue />) },
              { path: 'notifications', element: <AdminNotifications /> },
              { path: 'support', element: admin('ticket.read', <SupportQueue />) },
              { path: 'documents', element: admin('document.read', <DocumentsAdmin />) },
              { path: 'appointments', element: admin('appointment.read', <HubToday />) },
              { path: 'cancellations', element: admin('appointment.read', <Cancellations />) },
              { path: 'patients', element: admin('patient.read', <PatientRecords />) },
              { path: 'drift', element: admin('patient.flag_drift', <Drift />) },
              { path: 'codes', element: admin('enrolment.release_code', <PendingCodes />) },
            ],
          },
          ...phase2Routes,
          ...workspaceRoutes,
        ],
      },
    ],
  },
])
