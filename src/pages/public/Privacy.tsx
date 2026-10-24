import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'

/*
  Privacy notice for the patient service, on the website and in the Android
  app. Google Play links to it (https://app.fnphkaduna.cloud/privacy).

  Keep it true to what the system does. When something here changes (for
  example consultation recording is switched on), change this page and its
  date in the same release. Reviewed by FNPH before publication.
*/
const UPDATED = '20 October 2026'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-extrabold">{title}</h2>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-ink">{children}</div>
    </section>
  )
}

export function Privacy() {
  useDocumentTitle('Privacy notice')
  const s = usePublicSettings()
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <span className="kicker">Help and privacy</span>
      <h1 className="text-[clamp(2rem,4vw,3rem)] font-extrabold tracking-[-0.04em]">Privacy notice</h1>
      <p className="mt-2 text-sm text-muted">FNPH Kaduna Telepsychiatry, website and Android app. Last updated {UPDATED}.</p>

      <Section title="Who we are">
        <p>
          This service is run by the Federal Neuropsychiatric Hospital, Kaduna (FNPH Kaduna). FNPH Kaduna decides how your
          information is used and is responsible for it under the Nigeria Data Protection Act 2023.
        </p>
      </Section>

      <Section title="What we hold about you">
        <ul className="list-disc space-y-1 pl-5">
          <li>Your hospital identity from your FNPH record: EHR number, name, date of birth, and the phone and email on that record.</li>
          <li>What you tell us: the reason for a consultation, your vital signs, files you upload, and contact details you add.</li>
          <li>What your care team records: consultation notes, prescriptions, investigation requests and follow-up plans.</li>
          <li>Payments: amount, reference and status. Card and bank details are entered on Remita&apos;s payment page and are not stored by FNPH.</li>
          <li>Account and security records: when and from which device and network address you signed in, and a log of actions taken on your record.</li>
        </ul>
      </Section>

      <Section title="Why we use it">
        <p>
          To confirm you are an existing FNPH patient, arrange and hold your consultations, give you your prescriptions and
          investigation requests, take payment, keep your record accurate, keep the service secure, and meet the hospital&apos;s
          legal duties.
        </p>
      </Section>

      <Section title="Video consultations">
        <p>
          Your camera and microphone are used only while you are in a consultation. Consultations are not recorded. The video
          service is provided by Daily (daily.co) and the call is set up for your appointment only.
        </p>
      </Section>

      <Section title="Who can see it">
        <p>
          Only FNPH staff involved in your care or in running the service, and only what their role needs: for example, a
          pharmacist sees your prescription but not your consultation note. Actions on your record are logged.
        </p>
        <p>
          Some companies provide parts of the service for FNPH and handle information only to do that: Remita (payments), Daily
          (video), and the providers that host the servers and send email. FNPH does not sell your information, does not use it
          for advertising, and the app contains no advertising or tracking tools.
        </p>
      </Section>

      <Section title="On your phone">
        <p>
          The Android app keeps your sign-in in the phone&apos;s encrypted storage so you are not signed out when the app closes.
          It is only reused if you were active in the last 30 minutes, and is removed when you sign out. Documents you download are
          saved inside the app. The app does not back up its data to the cloud.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Your medical record, including what is recorded through this service, is kept for as long as the law and FNPH&apos;s
          health-records policy require. Closing your online account stops online access; it does not delete your medical record.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You can ask for a copy of your information, ask for it to be corrected, ask us to close your online account, and object
          to or ask us to limit how we use it. <Link to="/account-deletion">How to close your online account</Link>.
        </p>
        <p>
          Contact the hospital helpdesk at <a href={`mailto:${s.helpdeskEmail}`}>{s.helpdeskEmail}</a>. If you are not satisfied
          with our answer, you can complain to the Nigeria Data Protection Commission.
        </p>
      </Section>

      <Section title="Keeping it safe">
        <p>
          Information travels encrypted between your device and our servers. Staff accounts are personal, see only what their role
          allows, and their actions are logged. Idle sessions end automatically.
        </p>
      </Section>
    </div>
  )
}
