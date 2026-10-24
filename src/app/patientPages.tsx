import { lazy } from 'react'

/*
  The patient portal's pages, loaded on demand.

  Kept apart from phase2Pages, which lists every workspace: a bundler keeps
  each lazy import in a module it loads, so importing that list would put
  staff screens into the patient app.
*/
export const PortalHome = lazy(() => import('@/pages/portal/PortalHome').then((m) => ({ default: m.PortalHome })))
export const BookingFlow = lazy(() => import('@/pages/portal/BookingFlow').then((m) => ({ default: m.BookingFlow })))
export const PaymentReturn = lazy(() => import('@/pages/portal/PaymentReturn').then((m) => ({ default: m.PaymentReturn })))
export const Appointments = lazy(() => import('@/pages/portal/Appointments').then((m) => ({ default: m.Appointments })))
export const Documents = lazy(() => import('@/pages/portal/Documents').then((m) => ({ default: m.Documents })))
export const PatientRoom = lazy(() => import('@/pages/portal/PatientRoom').then((m) => ({ default: m.PatientRoom })))
