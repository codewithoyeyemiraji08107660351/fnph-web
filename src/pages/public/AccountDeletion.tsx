import { Link } from 'react-router-dom'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { formatPhone } from '@/lib/format'

/*
  How a patient closes their online account. Google Play requires this as a
  web page as well as inside the app (https://app.fnphkaduna.cloud/account-deletion).
*/
export function AccountDeletion() {
  useDocumentTitle('Close your online account')
  const s = usePublicSettings()
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <span className="kicker">Help and privacy</span>
      <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold tracking-[-0.04em]">Close your online account</h1>
      <p className="mt-3 text-[15px] leading-relaxed">
        You can ask the Federal Neuropsychiatric Hospital, Kaduna to close your <b>FNPH Telepsychiatry</b> account (Android app
        and website) at any time. The helpdesk confirms it is you before closing it.
      </p>

      <h2 className="mt-8 text-xl font-extrabold">In the app or on the website</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px]">
        <li>Sign in.</li>
        <li>Open <b>My profile</b> from your dashboard.</li>
        <li>Under <b>Close my online account</b>, tap <b>Ask to close my account</b> and send the request.</li>
      </ol>

      <h2 className="mt-8 text-xl font-extrabold">Without signing in or installing the app</h2>
      <p className="mt-2 text-[15px]">
        Email <a href={`mailto:${s.helpdeskEmail}?subject=Close my telepsychiatry account`}>{s.helpdeskEmail}</a> with your EHR
        number and the phone number on your hospital record, or visit the FNPH Kaduna helpdesk in person.
      </p>

      <h2 className="mt-8 text-xl font-extrabold">What closing does</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
        <li>You can no longer sign in, book, pay or join consultations online. Tell the helpdesk about any consultation already booked.</li>
        <li>
          Your hospital medical record is not deleted, including consultations, prescriptions and payments made through this
          service. The hospital must keep it by law. You can ask the helpdesk for a copy.
        </li>
      </ul>

      <p className="mt-8 text-sm text-muted">
        In an emergency, call <a href={`tel:${s.emergencyNumber}`}>{formatPhone(s.emergencyNumber)}</a>. See also the{' '}
        <Link to="/privacy">privacy notice</Link>.
      </p>
    </div>
  )
}
