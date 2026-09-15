import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { formatNaira, formatPhone } from '@/lib/format'

export function Help() {
  useDocumentTitle('Help and privacy')
  const s = usePublicSettings()
  const faqs: Array<[string, string]> = [
    ['Who can use this service?', 'Existing FNPH Kaduna patients who have been assessed in person and approved for follow-up by their clinical team. New patients must attend the hospital first.'],
    ['What if it is an emergency?', `Do not use this service. Call ${formatPhone(s.emergencyNumber)} or go to the nearest emergency service. Consultations are ended if an emergency becomes clear during a call, and the clinician will give you the approved escalation instruction.`],
    ['My EHR number is not recognised', 'You can submit a verification request from the enrolment page. The Hub Coordinator, Health Information Management and ICT check it against your hospital record. Your account stays inactive until the record is confirmed.'],
    ['How much does a consultation cost?', `The current fee is ${formatNaira(s.consultationFee)}, paid through Remita. Booking opens only after the hospital confirms the payment with Remita, not when the payment page says it succeeded.`],
    ['What should I prepare?', `A quiet, private, well-lit room, a charged phone or computer, a working camera and microphone, and a stable connection. Consultations last ${s.sessionMinutes} minutes and end on time.`],
    ['How long is a prescription valid?', `${s.prescriptionValidityDays} days from issue. Each document has a QR code. Anyone can scan it to confirm the document is genuine and still valid.`],
    ['Who can see my information?', 'Only the staff involved in your care, each limited to what their role needs. Pharmacy and laboratory staff do not see the doctor’s detailed notes. Every access is recorded in an audit log that cannot be edited.'],
    ['Are consultations recorded?', 'No. Recording is off. It can only be switched on after FNPH approves consent, retention and access rules, and you would be told clearly before and during any recording.'],
  ]
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <span className="kicker">Help and privacy</span>
      <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold tracking-[-0.04em]">Questions people ask</h1>
      <div className="mt-8 divide-y divide-line rounded-[20px] border border-line bg-white">
        {faqs.map(([q, a]) => (
          <details key={q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
              {q}
              <i aria-hidden className="bi bi-plus-lg text-accent transition-transform group-open:rotate-45" />
            </summary>
            <p className="mt-2 text-sm text-muted">{a}</p>
          </details>
        ))}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <a href={`tel:${s.emergencyNumber}`} className="rounded-[18px] bg-alarm-700 p-5 text-white no-underline">
          <span className="text-sm text-white/80">Clinical emergency</span>
          <span className="mt-1 block font-display text-2xl font-extrabold">{formatPhone(s.emergencyNumber)}</span>
        </a>
        <a href={`mailto:${s.helpdeskEmail}`} className="rounded-[18px] border border-line bg-white p-5 text-ink no-underline">
          <span className="text-sm text-muted">Technical helpdesk</span>
          <span className="mt-1 block font-display text-lg font-extrabold break-all">{s.helpdeskEmail}</span>
        </a>
      </div>
      <p className="mt-8 text-sm text-muted">
        Want to confirm a prescription or investigation request? <Link to="/verify">Check a document</Link>.
      </p>
    </div>
  )
}
