import { Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { bookingApi, carePathApi, documentsApi } from '@/lib/api/endpoints/patient'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useNow } from '@/lib/hooks/useNow'
import { formatDateTime, parseServerTime } from '@/lib/format'
import { ErrorState } from '@/components/ui/Page'

export function PortalHome() {
  const { principal }=useAuth()
  const appointments=useQuery({queryKey:['my-appointments'],queryFn:bookingApi.mine,refetchInterval:30000})
  const documents=useQuery({queryKey:['my-documents'],queryFn:documentsApi.mine})
  const consent=useQuery({queryKey:['consent-receipt'],queryFn:carePathApi.receipt})
  const now=useNow(1000)
  const next=appointments.data?.filter(a=>['AWAITING_APPROVAL','APPROVED','IN_PROGRESS'].includes(a.status) && (parseServerTime(a.scheduledEndAt)?.getTime()??0)>now).sort((a,b)=>a.appointmentDate.localeCompare(b.appointmentDate))[0]
  const start=parseServerTime(next?.appointmentDate)?.getTime()??0
  const opening=parseServerTime(next?.joinWindowOpensAt)?.getTime()??Infinity
  const live=!!next && ['APPROVED','IN_PROGRESS'].includes(next.status) && now>=opening && now<start+15*60000
  const seconds=Math.max(0,Math.floor((start-now)/1000))
  const countdown=`${Math.floor(seconds/86400)}d ${Math.floor(seconds%86400/3600)}h ${Math.floor(seconds%3600/60)}m ${seconds%60}s`
  if(consent.isLoading) return <p>Checking your first-time agreement…</p>
  if(consent.isError) return <ErrorState error={consent.error} onRetry={()=>consent.refetch()} />
  if(!consent.data?.publicId) return <Navigate to="/portal/consent" replace />
  return <><div className="stage-header"><div><span>Patient dashboard</span><strong>Your connected care journey</strong></div><span className="step-pill">Welcome back</span></div><div className="dashboard-welcome"><div><span className="eyebrow">Welcome back · {principal?.displayName}</span><h1>Your care, in one clear place.</h1><p>Request a non-emergency consultation, follow your approval, enter the live room when it opens and review documents released by the Hub Coordinator.</p></div><div className="welcome-flower" aria-hidden>✦</div></div>
    <div className="dashboard-actions"><Link className="button primary large" to="/portal/booking">Request a consultation →</Link><Link className="button secondary" to="/portal/profile">View my profile</Link></div>
    {next && ['APPROVED','IN_PROGRESS'].includes(next.status) && <div className="dashboard-countdown"><span className="countdown-icon">◷</span><div><small>APPROVED CONSULTATION</small><b>{seconds>0?countdown:'Your appointment time has arrived'}</b><span>{formatDateTime(next.appointmentDate)} WAT · {next.room}</span></div><Link className={live?'live-button':'button secondary'} to={live?`/portal/consultations/${next.publicId}`:'/portal/appointments'}>{live?'● LIVE · Join consultation':'View appointment'}</Link></div>}
    <div className="dashboard-grid"><section className="card dashboard-card"><span className="eyebrow">Upcoming consultation</span><h2>{next?next.status==='AWAITING_APPROVAL'?'Waiting for Hub approval':'Approved consultation':'No appointment yet'}</h2>{appointments.isError?<ErrorState error={appointments.error} onRetry={()=>appointments.refetch()} />:<p>{next?`${formatDateTime(next.appointmentDate)} WAT · ${next.reference}`:'Complete the safety check, provide recent vital signs, verify payment and choose an approved date.'}</p>}<Link className="button secondary" to="/portal/appointments">View appointments</Link></section><section className="card dashboard-card"><span className="eyebrow">My documents</span><h2>{documents.data?.some(d=>d.status==='ACTIVE')?'Your released care':'Nothing released yet'}</h2><p>A prescription or laboratory request appears here only if ordered, reviewed and released by the Hub Coordinator.</p>{documents.isError && <ErrorState error={documents.error} onRetry={()=>documents.refetch()} />}<Link className="button secondary" to="/portal/documents">View released care</Link></section></div>
    <div className="consent-receipt"><b>First-time agreement recorded</b><span>{consent.data.version} · {formatDateTime(consent.data.acceptedAt)} WAT</span><Link to="/portal/consent">View receipt</Link></div>
  </>
}
