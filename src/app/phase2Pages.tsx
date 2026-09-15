import { lazy } from 'react'

// Each workspace loads only for the people who use it.
export const PortalHome = lazy(() => import('@/pages/portal/PortalHome').then((m) => ({ default: m.PortalHome })))
export const BookingFlow = lazy(() => import('@/pages/portal/BookingFlow').then((m) => ({ default: m.BookingFlow })))
export const PaymentReturn = lazy(() => import('@/pages/portal/PaymentReturn').then((m) => ({ default: m.PaymentReturn })))
export const Appointments = lazy(() => import('@/pages/portal/Appointments').then((m) => ({ default: m.Appointments })))
export const Documents = lazy(() => import('@/pages/portal/Documents').then((m) => ({ default: m.Documents })))
export const PatientRoom = lazy(() => import('@/pages/portal/PatientRoom').then((m) => ({ default: m.PatientRoom })))

export const Approvals = lazy(() => import('@/pages/hub/Approvals').then((m) => ({ default: m.Approvals })))
export const ReleaseDesk = lazy(() => import('@/pages/hub/ReleaseDesk').then((m) => ({ default: m.ReleaseDesk })))
export const ReleaseBundleView = lazy(() => import('@/pages/hub/ReleaseBundleView').then((m) => ({ default: m.ReleaseBundleView })))
export const ReviewQueries = lazy(() => import('@/pages/hub/ReviewQueries').then((m) => ({ default: m.ReviewQueries })))

export const DoctorWorklist = lazy(() => import('@/pages/clinical/DoctorWorklist').then((m) => ({ default: m.DoctorWorklist })))
export const DoctorRoom = lazy(() => import('@/pages/clinical/DoctorRoom').then((m) => ({ default: m.DoctorRoom })))
export const ConsultationRecordPage = lazy(() => import('@/pages/clinical/ConsultationRecordPage').then((m) => ({ default: m.ConsultationRecordPage })))
export const WorkQueue = lazy(() => import('@/pages/clinical/WorkQueue').then((m) => ({ default: m.WorkQueue })))
export const ReviewQueue = lazy(() => import('@/pages/clinical/ReviewQueue').then((m) => ({ default: m.ReviewQueue })))
