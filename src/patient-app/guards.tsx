import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { FullPageLoader } from '@/components/ui/Spinner'

/** Sign-in and enrolment screens: a patient who is already signed in goes straight to their care. */
export function SignedOutOnly({ children }: { children: ReactNode }) {
  const { status, principal } = useAuth()
  if (status === 'loading') return <FullPageLoader label="Restoring your session" />
  if (principal?.scope === 'PATIENT') return <Navigate to="/portal" replace />
  return <>{children}</>
}

/**
  The app is for patients only. Staff accounts sign in on the website, where
  their workspaces are. A staff account that reaches the app any other way is
  told so and offered sign-out, rather than shown an empty patient screen.
*/
export function PatientOnly({ children }: { children: ReactNode }) {
  const { principal, signOut } = useAuth()
  if (principal && principal.scope !== 'PATIENT') {
    // Not the patient layout: it loads the signed-in patient's own records,
    // which a staff account cannot read.
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
        <div className="card max-w-md space-y-3 p-6">
          <span className="eyebrow">Patient app</span>
          <h1 className="text-xl font-extrabold">This app is for patients</h1>
          <p className="text-sm text-muted">Hospital and centre staff sign in on the FNPH Kaduna telepsychiatry website.</p>
          <button type="button" className="btn btn-primary" onClick={() => void signOut()}>Sign out</button>
        </div>
      </main>
    )
  }
  return <>{children}</>
}
