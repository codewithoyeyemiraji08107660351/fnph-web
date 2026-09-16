import { useState, type FormEvent } from 'react'
import { documentsAdminApi, recordingApi, type DocumentLookup } from '@/lib/api/endpoints/records'
import { toApiError } from '@/lib/api/http'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, humanise } from '@/lib/format'
import { PageHeader, Panel } from '@/components/ui/Page'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { TextField } from '@/components/ui/Field'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

export function DocumentsAdmin() {
  const { can } = useAuth()
  const toast = useToast()
  const [issue, setIssue] = useState('')
  const [doc, setDoc] = useState<DocumentLookup | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'allow' | 'revoke' | null>(null)
  const [consultation, setConsultation] = useState('')
  const [recordings, setRecordings] = useState<Array<Record<string, unknown>> | null>(null)

  const lookup = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!issue.trim()) return
    setBusy(true)
    setError(null)
    try {
      setDoc(await documentsAdminApi.lookup(issue.trim()))
    } catch (err) {
      setDoc(null)
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader kicker="Documents" title="Issued documents" description="Look up a prescription, investigation request or recommendation by the issue number printed on it." />
      <Panel>
        <form onSubmit={lookup} className="flex flex-wrap items-end gap-3">
          <TextField wrapperClassName="min-w-[240px] flex-1" label="Issue number" placeholder="RX-2609-K7M4NPQR" value={issue} onChange={(e) => setIssue(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Looking" inverted /> : 'Look up'}</button>
        </form>
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
        {doc && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-lg font-extrabold">{humanise(doc.documentType)} {doc.issueNumber}</p>
              <Badge tone={doc.status === 'ACTIVE' ? 'green' : doc.status === 'REVOKED' ? 'red' : 'grey'}>{humanise(doc.status)}</Badge>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted">Issued</dt><dd>{formatDateTime(doc.issuedAt)}</dd></div>
              <div><dt className="text-xs text-muted">Valid until</dt><dd>{formatDateTime(doc.expiresAt)}</dd></div>
              <div><dt className="text-xs text-muted">Downloads</dt><dd>{doc.downloadCount} of {doc.maxDownloads}</dd></div>
            </dl>
            {doc.revokedReason && <Alert tone="danger">Withdrawn: {doc.revokedReason}</Alert>}
            <div className="flex flex-wrap gap-2">
              {can('document.issue') && (
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={async () => {
                  setBusy(true); setError(null)
                  try { await documentsAdminApi.reissue(doc.issueNumber); toast('File rendered. The patient can download it now.'); await lookup() } catch (err) { setError(toApiError(err).message) } finally { setBusy(false) }
                }}>Render missing file</button>
              )}
              {can('document.issue') && doc.status === 'ACTIVE' && doc.downloadCount >= doc.maxDownloads && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog('allow')}>Allow one more download</button>
              )}
              {can('document.revoke') && doc.status === 'ACTIVE' && <button type="button" className="btn btn-danger btn-sm" onClick={() => setDialog('revoke')}>Withdraw</button>}
            </div>
            <p className="text-xs text-muted">“Render missing file” only works when the document was issued but its file failed to generate. A document that already has a file is never re-rendered.</p>
          </div>
        )}
      </Panel>

      {can('recording.read') && (
        <Panel title="Consultation recordings" className="mt-5">
          <form className="flex flex-wrap items-end gap-3" onSubmit={async (e) => {
            e.preventDefault()
            try { setRecordings(await recordingApi.list(consultation.trim())) } catch (err) { toast(toApiError(err).message, 'error') }
          }}>
            <TextField wrapperClassName="min-w-[240px] flex-1" label="Consultation id" value={consultation} onChange={(e) => setConsultation(e.target.value)} />
            <button type="submit" className="btn btn-secondary" disabled={!consultation.trim()}>Check</button>
          </form>
          {recordings && <p className="mt-3 text-sm">{recordings.length === 0 ? 'No recordings exist for this consultation. Recording is switched off for this service.' : `${recordings.length} recording(s).`}</p>}
        </Panel>
      )}

      {dialog === 'allow' && doc && (
        <ReasonDialog title="Allow one more download?" confirmLabel="Allow one more"
          description="Only for a patient whose download failed. It adds exactly one, and is recorded with your reason."
          label="What happened" placeholder="Patient's connection dropped mid-download; confirmed by phone that no file was saved."
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => { await documentsAdminApi.allowDownload(doc.issueNumber, reason); toast('One more download allowed.'); setDialog(null); await lookup() }} />
      )}
      {dialog === 'revoke' && doc && (
        <ReasonDialog title={`Withdraw ${doc.issueNumber}?`} danger confirmLabel="Withdraw"
          description="It stops verifying at pharmacies and laboratories straight away, and the patient sees it as withdrawn. This cannot be undone."
          label="Why" onClose={() => setDialog(null)}
          onConfirm={async (reason) => { await documentsAdminApi.revoke(doc.publicId, reason); toast('Document withdrawn.'); setDialog(null); await lookup() }} />
      )}
    </>
  )
}
