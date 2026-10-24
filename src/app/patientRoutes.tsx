import { Navigate, Outlet } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import type { ReactNode } from 'react'
import { RequirePermission, RequireRole } from '@/lib/auth/guards'
import { PatientConsent } from '@/features/patient/PatientConsent'
import { PatientOnboarding } from '@/features/patient/PatientOnboarding'
import { PatientProfile } from '@/features/patient/PatientProfile'
import { Appointments, BookingFlow, Documents, PatientRoom, PaymentReturn, PortalHome } from './patientPages'

/*
  The patient portal's routes, in one place.

  The website and the Android patient app both mount this object, so a
  patient screen added or changed here reaches both. Keep it free of anything
  staff-only: the app bundle is built from what this file imports.
*/

const gated = (permission: string, element: ReactNode) => <RequirePermission permission={permission}>{element}</RequirePermission>

export const patientPortalRoute: RouteObject = {
  path: 'portal',
  element: (
    <RequireRole roles={['PATIENT']}>
      <Outlet />
    </RequireRole>
  ),
  children: [
    { index: true, element: <PortalHome /> },
    { path: 'onboarding', element: <PatientOnboarding /> },
    { path: 'consent', element: <PatientConsent /> },
    { path: 'profile', element: <PatientProfile /> },
    { path: 'booking', element: gated('slot.hold', <BookingFlow />) },
    { path: 'payment', element: <PaymentReturn /> },
    { path: 'payment/return', element: <PaymentReturn /> },
    { path: 'appointments', element: <Appointments /> },
    { path: 'appointments/:appointmentId', element: <Appointments /> },
    { path: 'history', element: <Appointments /> },
    { path: 'documents', element: gated('document.read_own', <Documents />) },
    { path: 'consultations/:appointmentId', element: gated('consultation.join_as_patient', <PatientRoom />) },
    { path: '*', element: <Navigate to="/portal" replace /> },
  ],
}
