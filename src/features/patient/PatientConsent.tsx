import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { carePathApi } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import { ErrorState } from '@/components/ui/Page'
import { formatDateTime } from '@/lib/format'
import content from './journey-content.json'

export function PatientConsent({ onDone }: { onDone?: () => void }) {
  const doc = useQuery({ queryKey: ['consent'], queryFn: carePathApi.consent })
  const receipt = useQuery({ queryKey: ['consent-receipt'], queryFn: carePathApi.receipt })
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [read, setRead] = useState(false)
  const [declarations, setDeclarations] = useState(content.declarations.map(() => false))
  const [signature, setSignature] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (doc.isLoading || receipt.isLoading) return <p>Loading your agreement…</p>
  if (doc.isError || receipt.isError) return <ErrorState error={doc.error ?? receipt.error} onRetry={() => { void doc.refetch(); void receipt.refetch() }} />
  const done = () => onDone ? onDone() : navigate('/portal')
  if (receipt.data?.version === doc.data?.version) return <div className="card"><span className="eyebrow">First-time agreement recorded</span><h1>Your consent receipt</h1><p>{receipt.data?.version} · {formatDateTime(receipt.data?.acceptedAt)} WAT</p><p>Reference: {receipt.data?.publicId}</p><p>Signed by {receipt.data?.signature}</p><button className="button primary" onClick={done}>Continue</button></div>
  return <><div className="stage-header"><div><span>First-time setup</span><strong>Read the service agreement</strong></div><span className="step-pill">Step 1 of 2</span></div><div className="screen-heading"><span className="eyebrow">First-time service agreement</span><h1>Read the safety and data-protection notice</h1><p>Complete this agreement once. After the safety questions, you will go to your patient dashboard.</p></div><div className="notice amber"><b>This service is not for emergencies.</b><span>For verified existing patients previously assessed in person and suitable for remote follow-up.</span></div>
    <form className="card consent-card" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await carePathApi.acceptConsent({ version: doc.data!.version, read, signature, declarations }); await qc.invalidateQueries({ queryKey: ['consent-receipt'] }); done() } catch (err) { setError(toApiError(err).message) } finally { setBusy(false) } }}>
      <div className="notice-heading"><div><span className="eyebrow">{doc.data?.title}</span><h2>{doc.data?.version}</h2></div></div>
      <div className="agreement">{doc.data?.body.split(/\n\s*\n/).map((part, i) => { const [title, ...body] = part.split('\n'); return <details key={i} open={i === 0}><summary>{title}</summary><p>{body.join('\n') || title}</p></details> })}</div>
      <button className="button secondary mark-read" type="button" onClick={() => setRead(true)}>{read ? 'Agreement read ✓' : 'I have read the complete agreement'}</button>
      <div className="consent-declarations"><p>After reading, confirm each declaration:</p>{content.declarations.map((text, i) => <label key={text}><input type="checkbox" disabled={!read} checked={declarations[i]} onChange={e => setDeclarations(values => values.map((v, j) => j === i ? e.target.checked : v))} /><span>{text}</span></label>)}</div>
      <label className="signature-label">Type your full name as your electronic signature<input autoComplete="name" disabled={!read} maxLength={150} value={signature} onChange={e => setSignature(e.target.value)} placeholder="First name and surname" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy || !read || !declarations.every(Boolean) || signature.trim().split(/\s+/).length < 2}>{busy ? 'Recording consent…' : 'Accept and continue'}</button>
    </form></>
}
