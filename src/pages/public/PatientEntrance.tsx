import { Link } from 'react-router-dom'
import { SignInPanel } from '@/features/auth/SignInPanel'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { formatNaira } from '@/lib/format'
import { EntranceLayout } from './EntranceLayout'

export function PatientEntrance() {
  useDocumentTitle('Patient services')
  const { consultationFee, sessionMinutes, noShowMinutes, cancellationHours } = usePublicSettings()
  const steps = [
    'Safety triage and consent',
    'Reason for your consultation',
    'Recent vital signs, with the time and how they were measured',
    'Laboratory results, if you have them',
    `Consultation fee of ${formatNaira(consultationFee)} through Remita`,
    `Choose an available ${sessionMinutes}-minute slot`,
    'Hub Coordinator approves and assigns your room',
    'Join your secure video consultation',
  ]
  return (
    <EntranceLayout
      portal="patient"
      card={
        <>
          <SignInPanel portal="patient" />
          <div className="mt-6 border-t border-line pt-5 text-sm">
            <p className="font-bold">First time here?</p>
            <p className="mt-1 text-muted">Enrol with the EHR number on your hospital card. No new hospital record is created online.</p>
            <Link to="/enrol" className="btn btn-secondary mt-3 w-full no-underline">
              Enrol with my EHR number
            </Link>
          </div>
        </>
      }
    >
      <span className="kicker">Existing FNPH Kaduna patients only</span>
      <h1 className="text-[clamp(2.2rem,4.6vw,3.8rem)] leading-[1.04] font-extrabold tracking-[-0.045em]">Your follow-up care, wherever you are</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        Secure video consultations for patients who have already been assessed in person by an FNPH Kaduna psychiatrist and approved for follow-up.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[18px] border border-line bg-white p-5">
          <p className="flex items-center gap-2 font-bold text-forest">
            <i aria-hidden className="bi bi-check-circle-fill" /> You can use this service if
          </p>
          <p className="mt-2 text-sm text-muted">You have an FNPH Kaduna EHR number and your clinical team has approved remote follow-up.</p>
        </div>
        <div className="rounded-[18px] border border-[#e9c3c0] bg-blush/60 p-5">
          <p className="flex items-center gap-2 font-bold text-alarm">
            <i aria-hidden className="bi bi-x-octagon-fill" /> Go to a hospital instead if
          </p>
          <p className="mt-2 text-sm text-alarm-700">
            You are a new patient, or there is an emergency, severe agitation, acute psychosis or any immediate risk to you or someone else.
          </p>
        </div>
      </div>

      <h2 className="mt-12 text-xl font-extrabold">What happens, in order</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mint font-display text-sm font-bold text-forest">{i + 1}</span>
            <span className="pt-1">{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-[18px] bg-white p-5 text-sm leading-relaxed text-muted">
        <p className="font-bold text-ink">Before your appointment</p>
        <p className="mt-1">
          Start and end times are fixed. If you join late, you have less time. If you have not joined {noShowMinutes} minutes after the start, the link
          closes and the appointment is recorded as missed. You can cancel or reschedule while more than {cancellationHours} hours remain. Use a quiet,
          private, well-lit room, a charged device and a stable connection.
        </p>
      </div>
    </EntranceLayout>
  )
}
