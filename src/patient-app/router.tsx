import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { RouteError } from '@/components/layout/RouteError'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth } from '@/lib/auth/guards'
import { PatientExperience } from '@/features/patient/PatientExperience'
import { PatientEntrance } from '@/pages/public/PatientEntrance'
import { Enrol } from '@/pages/public/Enrol'
import { Help } from '@/pages/public/Help'
import { Privacy } from '@/pages/public/Privacy'
import { AccountDeletion } from '@/pages/public/AccountDeletion'
import { Account } from '@/pages/account/Account'
import { VerifyDocument } from '@/pages/public/VerifyDocument'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { ForcedPasswordChange } from '@/pages/account/ForcedPasswordChange'
import { patientPortalRoute } from '@/app/patientRoutes'
import { PatientOnly, SignedOutOnly } from './guards'
import { NativeShell } from './NativeShell'

/*
  The Android patient app's routes.

  The patient portal itself is the same route object the website mounts.
  Around it sit only the screens a patient reaches before signing in, laid
  out in the patient design rather than the website's public header, which
  carries staff and centre sign-in links that have no place in this app.

  Paths the shared screens link to are kept as they are on the website
  (/patients, /sign-in, /enrol, /help and so on), so no shared screen needs
  to know which front end it is running in. Anything else returns to the
  start, which is sign-in or, once signed in, the patient's dashboard.
*/

const signIn = (
  <SignedOutOnly>
    <PatientEntrance />
  </SignedOutOnly>
)

export const patientAppRouter = createBrowserRouter([
  {
    element: <NativeShell />,
    errorElement: <RouteError />,
    children: [
      {
        element: (
          <PatientExperience>
            <Outlet />
          </PatientExperience>
        ),
        children: [
          { index: true, element: signIn },
          { path: 'patients', element: signIn },
          { path: 'sign-in', element: signIn },
          { path: 'enrol', element: <SignedOutOnly><Enrol /></SignedOutOnly> },
          { path: 'forgot-password', element: <ForgotPassword /> },
          { path: 'reset-password', element: <ResetPassword /> },
          { path: 'help', element: <Help /> },
          { path: 'privacy', element: <Privacy /> },
          { path: 'account-deletion', element: <AccountDeletion /> },
          { path: 'verify', element: <VerifyDocument /> },
          { path: 'verify/:token', element: <VerifyDocument /> },
        ],
      },
      {
        element: (
          <RequireAuth>
            <PatientOnly>
              <AppShell />
            </PatientOnly>
          </RequireAuth>
        ),
        children: [
          { path: 'home', element: <Navigate to="/portal" replace /> },
          // My profile links here for password and signed-in devices.
          { path: 'account', element: <Account /> },
          { path: 'account/password', element: <ForcedPasswordChange /> },
          patientPortalRoute,
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
