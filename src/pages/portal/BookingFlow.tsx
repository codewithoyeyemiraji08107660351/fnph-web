import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { carePathApi, intakeApi, type IntakeDraft } from '@/lib/api/endpoints/patient'
import type { Appointment, TriageResult } from '@/lib/api/types'
import { PatientConsent } from '@/features/patient/PatientConsent'
import { TriageStep, StopScreen } from '@/features/patient/SafetyStep'
import { IntakeStep } from '@/features/patient/IntakeStep'
import { CalendarStep } from '@/features/patient/CalendarStep'
import { ErrorState } from '@/components/ui/Page'
import { PaymentStep } from './PaymentStep'
import { formatDateTime } from '@/lib/format'

export function BookingFlow() {
  const qc = useQueryClient()
  const receipt = useQuery({queryKey:['consent-receipt'],queryFn:carePathApi.receipt})
  const saved = useQuery({queryKey:['patient-intake'],queryFn:intakeApi.current})
  const [step,setStep]=useState<'triage'|'intake'|'payment'|'schedule'>('triage')
  const [draft,setDraft]=useState<IntakeDraft|null>(null)
  const [stopped,setStopped]=useState<TriageResult|null>(null)
  const [appointment,setAppointment]=useState<Appointment|null>(null)
  if(receipt.isLoading || saved.isLoading) return <p>Loading your care information…</p>
  if(receipt.isError || saved.isError) return <ErrorState error={receipt.error ?? saved.error} onRetry={() => {void receipt.refetch();void saved.refetch()}} />
  if(!receipt.data?.publicId) return <PatientConsent onDone={() => {void receipt.refetch()}} />
  if(stopped) return <StopScreen result={stopped} />
  if(appointment) return <div className="status-card"><span className="status-icon amber">◷</span><span className="eyebrow">Request submitted</span><h1>Waiting for Hub Coordinator approval</h1><p>Your payment is verified and your requested time is reserved. The Hub Coordinator reviews your request and assigns the care team and room.</p><p><b>{formatDateTime(appointment.appointmentDate)} WAT</b></p><p>Reference {appointment.reference}</p><Link className="button primary" to="/portal/appointments">View my appointment</Link></div>
  return <><ol className="journey-progress" aria-label="Request progress">{['triage','intake','payment','schedule'].map((s,i)=><li key={s} aria-current={s===step?'step':undefined}>{i+1}. {['Safety check','Recent information','Payment','Date & time'][i]}</li>)}</ol>
    {step==='triage' && <TriageStep onProceed={() => setStep('intake')} onStop={setStopped} />}
    {step==='intake' && <IntakeStep initial={draft ?? saved.data} onSaved={d => {setDraft(d);setStep('payment');void qc.invalidateQueries({queryKey:['patient-intake']})}} />}
    {step==='payment' && <PaymentStep onPaid={() => setStep('schedule')} />}
    {step==='schedule' && (draft ?? saved.data) && <CalendarStep draft={(draft ?? saved.data)!} onBooked={a => {setAppointment(a);void qc.invalidateQueries({queryKey:['my-appointments']});void qc.invalidateQueries({queryKey:['patient-intake']});void qc.invalidateQueries({queryKey:['my-payments']})}} />}
  </>
}
