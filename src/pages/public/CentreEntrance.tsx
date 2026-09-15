import { SignInPanel } from '@/features/auth/SignInPanel'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { EntranceLayout } from './EntranceLayout'

export function CentreEntrance() {
  useDocumentTitle('Centres of Excellence')
  return (
    <EntranceLayout portal="centre" card={<SignInPanel portal="centre" />}>
      <span className="kicker">Kaduna State Government Centres of Excellence</span>
      <h1 className="text-[clamp(2.2rem,4.6vw,3.8rem)] leading-[1.04] font-extrabold tracking-[-0.045em]">
        Specialist psychiatric input for every local government area
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        Twenty-three centres refer patients to FNPH Kaduna specialists through a fully online pathway, from referral to released care bundle.
      </p>
      <dl className="mt-10 grid gap-4 sm:grid-cols-2">
        {[
          ['Your centre only', 'Each centre sees its own patients, referrals, appointments and bundles. No centre can open another centre’s records.'],
          ['Complete online record', 'Referral, consultation note, reviewed prescription and follow-up are kept in this platform, not in the FNPH offline EHR.'],
          ['No patient payments', 'Bookings are funded centrally. Your dashboard shows consultation and utilisation counts only.'],
          ['Hub-to-hub video', 'Consultations run between your centre and the FNPH hub, video first, with audio only when needed.'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-[18px] bg-white p-5">
            <dt className="font-bold text-gold-700">{t}</dt>
            <dd className="mt-1.5 text-sm text-muted">{d}</dd>
          </div>
        ))}
      </dl>
    </EntranceLayout>
  )
}
