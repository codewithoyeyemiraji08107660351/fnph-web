import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { RouteError } from '@/components/layout/RouteError'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth, RequirePermission, RequireRole, DashboardRedirect } from '@/lib/auth/guards'
import { CENTRAL_ADMINISTRATOR, ROLES } from '@/lib/auth/roles'
import { Landing } from '@/pages/public/Landing'
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

const phase2Routes = [
  workspace(['PATIENT'], [
    { index: true, element: <PortalHome /> },
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
    { path: '*', element: <Navigate to="/hub" replace /> },
  ], 'hub'),
  workspace(['DOCTOR'], [
    { index: true, element: gated('consultation.join_as_doctor', <DoctorWorklist />) },
    { path: 'appointments/:appointmentId', element: gated('consultation.join_as_doctor', <DoctorRoom />) },
    { path: 'consultations/:consultationId', element: gated('clinical_note.read', <ConsultationRecordPage />) },
    { path: '*', element: <Navigate to="/clinical" replace /> },
  ], 'clinical'),
  workspace(['PHARMACIST'], [{ index: true, element: gated('review.pharmacy', <ReviewQueue kind="pharmacy" />) }], 'reviews/pharmacy'),
  workspace(['LABORATORY_TECHNICIAN'], [{ index: true, element: gated('review.laboratory', <ReviewQueue kind="laboratory" />) }], 'reviews/laboratory'),
  workspace(['NURSING'], [{ index: true, element: gated('queue.nursing', <WorkQueue kind="nursing" />) }], 'queues/nursing'),
  workspace(['HIM'], [{ index: true, element: gated('queue.him', <WorkQueue kind="him" />) }], 'queues/him'),
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
            ],
          },
          ...phase2Routes,
          ...workspaceRoutes,
        ],
      },
    ],
  },
])
