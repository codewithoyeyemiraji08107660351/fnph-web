import { SignInPanel } from '@/features/auth/SignInPanel'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { EntranceLayout } from './EntranceLayout'

const ROLE_CHIPS = ['Central Administrator', 'Hub Coordinator', 'Doctor', 'Pharmacist', 'Laboratory Technician', 'Nurse', 'Health Information Management', 'Finance']

export function StaffEntrance() {
  useDocumentTitle('Staff sign in')
  return (
    <EntranceLayout portal="core" card={<SignInPanel portal="core" />}>
      <span className="kicker">Hospital operations and clinical coordination</span>
      <h1 className="text-[clamp(2.2rem,4.6vw,3.8rem)] leading-[1.04] font-extrabold tracking-[-0.045em]">
        One controlled engine for every role in the consultation pathway
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        Your account decides where you land. There is no role to pick: sign in and you go straight to the workspace your role allows.
      </p>
      <ul className="mt-7 flex flex-wrap gap-2" aria-label="Roles served">
        {ROLE_CHIPS.map((r) => (
          <li key={r} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-navy">
            {r}
          </li>
        ))}
      </ul>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[18px] bg-white p-5">
          <p className="font-bold text-navy">
            <i aria-hidden className="bi bi-shield-check mr-2" />
            Simple sign in
          </p>
          <p className="mt-1.5 text-sm text-muted">Use the username and password issued through your account invitation.</p>
        </div>
        <div className="rounded-[18px] bg-white p-5">
          <p className="font-bold text-navy">
            <i aria-hidden className="bi bi-envelope-open mr-2" />
            New account?
          </p>
          <p className="mt-1.5 text-sm text-muted">Use the invitation link Central Administration emailed you to choose your password. Links last 72 hours.</p>
        </div>
      </div>
    </EntranceLayout>
  )
}
