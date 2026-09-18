import { Link } from 'react-router-dom'
import { SignInPanel } from '@/features/auth/SignInPanel'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'

export function PatientEntrance() {
  useDocumentTitle('Patient services')
  return <><div className="stage-header"><div><span>Secure patient access</span><strong>Sign in to continue your care</strong></div><span className="step-pill">Your account</span></div><div className="screen-heading"><span className="eyebrow">Secure patient access</span><h1>Sign in to your account</h1><p>Use your verified EHR number and password. First-time patients can enrol with the hospital number printed on their FNPH card.</p></div><div className="card sign-in-card"><SignInPanel portal="patient" /><small>First sign-in continues to the telepsychiatry agreement. Later sign-ins go to your dashboard.</small><div className="form-foot"><Link className="text-button" to="/enrol">First time here? Enrol with my EHR number</Link></div></div></>
}
