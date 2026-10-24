import { Link, useLocation } from 'react-router-dom'
import { SignInPanel } from '@/features/auth/SignInPanel'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'

export function PatientEntrance() {
  useDocumentTitle('Patient services')
  const from = (useLocation().state as { from?: string } | null)?.from ?? ''
  // Remita returns here after payment. When the patient paid from the
  // Android app this page opens in a browser tab over the app, signed out.
  const backFromPayment = from.startsWith('/portal/payment') && document.documentElement.dataset.shell !== 'app'
  return <>{backFromPayment && <div className="card mb-4 p-4 text-sm"><strong className="block">Paying from the FNPH app?</strong>Close this page to go back to the app. It checks your payment for you. Paying on the website? Sign in below to continue.</div>}<div className="stage-header"><div><span>Secure patient access</span><strong>Sign in to continue your care</strong></div><span className="step-pill">Your account</span></div><div className="screen-heading"><span className="eyebrow">Secure patient access</span><h1>Sign in to your account</h1><p>Use your verified EHR number and password. First-time patients can enrol with the hospital number printed on their FNPH card.</p></div><div className="card sign-in-card"><SignInPanel portal="patient" /><small>First sign-in continues to the telepsychiatry agreement. Later sign-ins go to your dashboard.</small><div className="form-foot"><Link className="text-button" to="/enrol">First time here? Enrol with my EHR number</Link></div></div></>
}
