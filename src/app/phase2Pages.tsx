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

// Phase 3 and Phase 4
export const CentreHome = lazy(() => import('@/pages/centre/CentreHome').then((m) => ({ default: m.CentreHome })))
export const CentrePatients = lazy(() => import('@/pages/centre/Patients').then((m) => ({ default: m.Patients })))
export const CentrePatientDetail = lazy(() => import('@/pages/centre/PatientDetail').then((m) => ({ default: m.PatientDetail })))
export const CentreReferrals = lazy(() => import('@/pages/centre/Referrals').then((m) => ({ default: m.Referrals })))
export const CentreConsultations = lazy(() => import('@/pages/centre/Consultations').then((m) => ({ default: m.Consultations })))
export const CentreIncoming = lazy(() => import('@/pages/centre/Incoming').then((m) => ({ default: m.Incoming })))
export const CentreRoom = lazy(() => import('@/pages/centre/CentreRoom').then((m) => ({ default: m.CentreRoom })))
export const CapabilityWorkspace = lazy(() => import('@/pages/centre/CapabilityWorkspace').then((m) => ({ default: m.CapabilityWorkspace })))
export const CentreApprovals = lazy(() => import('@/pages/hub/CentreApprovals').then((m) => ({ default: m.CentreApprovals })))

export const Schedules = lazy(() => import('@/pages/admin/Schedules').then((m) => ({ default: m.Schedules })))
export const Rooms = lazy(() => import('@/pages/admin/Rooms').then((m) => ({ default: m.Rooms })))
export const Rota = lazy(() => import('@/pages/admin/Rota').then((m) => ({ default: m.Rota })))
export const AdminCentres = lazy(() => import('@/pages/admin/Centres').then((m) => ({ default: m.Centres })))
export const AdminNotifications = lazy(() => import('@/pages/admin/Notifications').then((m) => ({ default: m.Notifications })))

export const FinanceOverview = lazy(() => import('@/pages/finance/Overview').then((m) => ({ default: m.FinanceOverview })))
export const Wallets = lazy(() => import('@/pages/finance/Wallets').then((m) => ({ default: m.Wallets })))
export const Payments = lazy(() => import('@/pages/finance/Payments').then((m) => ({ default: m.Payments })))
export const Reconciliation = lazy(() => import('@/pages/finance/Reconciliation').then((m) => ({ default: m.Reconciliation })))
export const Reports = lazy(() => import('@/pages/finance/Reports').then((m) => ({ default: m.Reports })))

export const EhrImports = lazy(() => import('@/pages/ict/EhrImports').then((m) => ({ default: m.EhrImports })))
export const VerificationQueue = lazy(() => import('@/pages/ict/VerificationQueue').then((m) => ({ default: m.VerificationQueue })))
export const Quarantine = lazy(() => import('@/pages/ict/Quarantine').then((m) => ({ default: m.Quarantine })))
export const SupportQueue = lazy(() => import('@/pages/support/SupportQueue').then((m) => ({ default: m.SupportQueue })))
export const MySupport = lazy(() => import('@/pages/support/MySupport').then((m) => ({ default: m.MySupport })))

// Remaining integrations
export const DocumentsAdmin = lazy(() => import('@/pages/admin/DocumentsAdmin').then((m) => ({ default: m.DocumentsAdmin })))
export const HubToday = lazy(() => import('@/pages/hub/Today').then((m) => ({ default: m.Today })))
export const Cancellations = lazy(() => import('@/pages/hub/Cancellations').then((m) => ({ default: m.Cancellations })))
export const PatientRecords = lazy(() => import('@/pages/records/PatientRecords').then((m) => ({ default: m.PatientRecords })))
export const Drift = lazy(() => import('@/pages/records/Drift').then((m) => ({ default: m.Drift })))
export const PendingCodes = lazy(() => import('@/pages/records/PendingCodes').then((m) => ({ default: m.PendingCodes })))
