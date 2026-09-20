import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { bookingApi, carePathApi, intakeApi, type IntakeDraft } from '@/lib/api/endpoints/patient'
import { patientRecordsApi } from '@/lib/api/endpoints/records'
import type { Appointment } from '@/lib/api/types'
import { StopScreen } from '@/features/patient/SafetyStep'
import { IntakeStep } from '@/features/patient/IntakeStep'
import { CalendarStep } from '@/features/patient/CalendarStep'
import { ErrorState } from '@/components/ui/Page'
import { PaymentStep } from './PaymentStep'
import { formatDateTime } from '@/lib/format'

export function BookingFlow() {
  const qc = useQueryClient()
  const receipt = useQuery({queryKey:['consent-receipt'],queryFn:carePathApi.receipt})
  const saved = useQuery({queryKey:['patient-intake'],queryFn:intakeApi.current})
  const appointments = useQuery({queryKey:['my-appointments'],queryFn:bookingApi.mine})
  const patient = useQuery({queryKey:['my-record'],queryFn:patientRecordsApi.me})
  const triage = useQuery({queryKey:['triage-history'],queryFn:carePathApi.triageHistory})
  const [step,setStep]=useState<'start'|'intake'|'payment'|'schedule'>('start')
  const [draft,setDraft]=useState<IntakeDraft|null>(null)
  const [appointment,setAppointment]=useState<Appointment|null>(null)
  if(receipt.isLoading || saved.isLoading || appointments.isLoading || patient.isLoading || triage.isLoading) return <p>Loading your care information…</p>
  if(receipt.isError || saved.isError || appointments.isError || patient.isError || triage.isError) return <ErrorState error={receipt.error ?? saved.error ?? appointments.error ?? patient.error ?? triage.error} onRetry={() => {void receipt.refetch();void saved.refetch();void appointments.refetch();void patient.refetch();void triage.refetch()}} />
  if(!receipt.data?.publicId || !triage.data?.length) return <Navigate to="/portal/onboarding" replace />
  const latestTriage = triage.data[0]
  if(latestTriage.outcome !== 'PROCEED') return <StopScreen result={latestTriage} />
  const syncedAppointment = appointment ?? appointments.data?.find(a => ['SLOT_HELD','AWAITING_APPROVAL','APPROVED','RESCHEDULED','IN_PROGRESS'].includes(a.status)) ?? null
  if(syncedAppointment) return <div className="status-card"><span className="status-icon amber">◷</span><span className="eyebrow">Request submitted</span><h1>{syncedAppointment.status === 'AWAITING_APPROVAL' ? 'Waiting for Hub Coordinator approval' : 'Your consultation is scheduled'}</h1><p>Your payment and selected appointment are linked. The care team can see the same booking status shown in your appointments.</p><p><b>{formatDateTime(syncedAppointment.appointmentDate)} WAT</b></p><p>Reference {syncedAppointment.reference}</p><Link className="button primary" to="/portal/appointments">View my appointment</Link></div>
  const currentStep = step === 'start' ? (saved.data ? 'payment' : 'intake') : step
  const stage = { intake: ['Consultation request', 'Tell the team what you need', 'Request · 1 of 3'], payment: ['Payment confirmation', 'Complete the consultation fee', 'Request · 2 of 3'], schedule: ['Booking', 'Choose a published date and time', 'Request · 3 of 3'] }[currentStep]
  const progress = currentStep === 'intake' ? 2 : currentStep === 'payment' ? 3 : 4
  return <><div className="stage-header"><div><span>{stage[0]}</span><strong>{stage[1]}</strong></div><span className="step-pill">Secure patient portal</span></div>
    <ol className="booking-progress" aria-label="Booking progress">{[['Safety','bi-shield-check'],['Vitals','bi-heart-pulse'],['Payment','bi-credit-card'],['Date & time','bi-calendar-event'],['Hub approval','bi-person-check'],['Consultation','bi-camera-video']].map(([label,icon],index) => <li key={label} className={index + 1 < progress ? 'complete' : index + 1 === progress ? 'current' : ''}><span>{index + 1 < progress ? '✓' : index + 1}</span><i className={`bi ${icon}`} aria-hidden /><b>{label}</b></li>)}</ol>
    {currentStep === 'schedule' && <div className="booking-completions"><div><span>✓</span><p><b>Safety screening passed</b><small>Routine follow-up pathway</small></p></div><div><span>✓</span><p><b>Recent vital signs supplied</b><small>Recorded for this request</small></p></div><div><span>✓</span><p><b>Remita payment verified</b><small>Server confirmation received</small></p></div></div>}
    {currentStep==='intake' && <IntakeStep initial={draft ?? saved.data} onSaved={d => {setDraft(d);setStep('payment');void qc.invalidateQueries({queryKey:['patient-intake']})}} />}
    {currentStep==='payment' && <PaymentStep onBack={() => setStep('intake')} onPaid={() => setStep('schedule')} />}
    {currentStep==='schedule' && (draft ?? saved.data) && <CalendarStep draft={(draft ?? saved.data)!} onBooked={a => {setAppointment(a);void qc.invalidateQueries({queryKey:['my-appointments']});void qc.invalidateQueries({queryKey:['patient-intake']});void qc.invalidateQueries({queryKey:['my-payments']})}} />}
  </>
}
