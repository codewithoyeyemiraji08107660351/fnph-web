import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { documentsApi, myRecordsApi } from '@/lib/api/endpoints/patient'
import { followUpsApi, uploadsApi } from '@/lib/api/endpoints/records'
import { FileList } from '@/features/files/AttachedFiles'
import { toApiError } from '@/lib/api/http'
import type { IssuedDocument } from '@/lib/api/types'
import { formatDateTime, humanise } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

function statusBadge(d: IssuedDocument) {
  switch (d.status) {
    case 'ACTIVE':
      return <Badge tone="green">Valid</Badge>
    case 'EXPIRED':
      return <Badge>Expired</Badge>
    case 'REVOKED':
      return <Badge tone="red">Withdrawn</Badge>
    case 'SUPERSEDED':
      return <Badge tone="gold">Replaced</Badge>
    default:
      return <Badge>{humanise(d.status)}</Badge>
  }
}

function QrCode({ id, label }: { id: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let revoked = false
    let objectUrl: string | null = null
    documentsApi
      .qr(id)
      .then((blob) => {
        if (revoked) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => setFailed(true))
    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])
  if (failed) return <p className="text-sm text-alarm">The code could not be loaded.</p>
  if (!url) return <Spinner label="Loading code" />
  return <img src={url} alt={`Verification code for ${label}`} width={200} height={200} className="mx-auto rounded-[12px] border border-line bg-white p-2" />
}

export function Documents() {
  const qc = useQueryClient()
  const toast = useToast()
  const docs = useQuery({ queryKey: ['my-documents'], queryFn: documentsApi.mine })
  const prescriptions = useQuery({ queryKey: ['my-prescriptions'], queryFn: myRecordsApi.prescriptions })
  const investigations = useQuery({ queryKey: ['my-investigations'], queryFn: myRecordsApi.investigations })
  const [confirming, setConfirming] = useState<IssuedDocument | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qrFor, setQrFor] = useState<IssuedDocument | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const followUps = useQuery({ queryKey: ['my-follow-ups'], queryFn: followUpsApi.mine })
  const files = useQuery({ queryKey: ['my-files'], queryFn: uploadsApi.mine })

  const download = async (d: IssuedDocument) => {
    setDownloading(true)
    setError(null)
    try {
      // This request is the one claim. Nothing is called before it.
      const { blob, filename } = await documentsApi.downloadFile(d.publicId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      toast('Saved. Keep the file somewhere you can find it again.')
      setConfirming(null)
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setDownloading(false)
      void qc.invalidateQueries({ queryKey: ['my-documents'] })
    }
  }

  const contents = (d: IssuedDocument) => {
    if (d.documentType === 'PRESCRIPTION') {
      const p = prescriptions.data?.find((x) => x.issueNumber === d.issueNumber)
      if (!p) return null
      return (
        <table className="table-base mt-3 min-w-[480px]">
          <thead><tr><th>Medicine</th><th>Strength</th><th>How often</th><th>For how long</th></tr></thead>
          <tbody>
            {p.items.map((i, n) => (
              <tr key={n}>
                <td className="font-bold">{i.medication}{i.instructions && i.instructions !== 'null' && <span className="block text-xs font-normal text-muted">{i.instructions}</span>}</td>
                <td>{i.strength}</td><td>{i.frequency}</td><td>{i.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    const inv = investigations.data?.find((x) => x.issueNumber === d.issueNumber)
    if (!inv) return null
    return (
      <ul className="mt-3 list-disc pl-5 text-sm">
        {inv.panels.map((p, n) => <li key={n}>{p.panelName}</li>)}
      </ul>
    )
  }

  return (
    <>
      <PageHeader kicker="My care" title="Documents" description="Prescriptions and investigation requests released by the hospital after your consultation." />
      {error && <Alert tone="danger" className="mb-5">{error}</Alert>}
      {docs.isLoading && <Spinner label="Loading documents" />}
      {docs.isError && <ErrorState error={docs.error} onRetry={() => docs.refetch()} />}
      {docs.data?.length === 0 && (
        <div className="card">
          <EmptyState icon="bi-file-earmark-medical" title="Nothing here yet">
            Documents appear after your consultation, once the hospital has reviewed and released them.
          </EmptyState>
        </div>
      )}
      <ul className="space-y-4">
        {docs.data?.map((d) => {
          const left = Math.max(0, d.maxDownloads - d.downloadCount)
          const canDownload = d.status === 'ACTIVE' && left > 0
          return (
            <li key={d.publicId} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-extrabold">{humanise(d.documentType)}</p>
                  <p className="text-sm text-muted">
                    {d.issueNumber} {d.issuedAt && `. Issued ${formatDateTime(d.issuedAt)}`} {d.expiresAt && `. Valid until ${formatDateTime(d.expiresAt)}`}
                  </p>
                </div>
                {statusBadge(d)}
              </div>
              {d.revokedReason && <Alert tone="danger" className="mt-3">{d.revokedReason}</Alert>}
              <p className="mt-3 text-sm">
                {canDownload ? (
                  <span>You can download this {left === 1 ? 'once' : `${left} more times`}.</span>
                ) : d.status === 'ACTIVE' ? (
                  <span className="text-muted">Already downloaded. You can still read it here until it expires.</span>
                ) : null}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canDownload && (
                  <button type="button" className="btn btn-primary" onClick={() => { setError(null); setConfirming(d) }}>
                    <i aria-hidden className="bi bi-download" /> Download
                  </button>
                )}
                <button type="button" className="btn btn-secondary" aria-expanded={open === d.publicId} onClick={() => setOpen(open === d.publicId ? null : d.publicId)}>
                  {open === d.publicId ? 'Hide contents' : 'Read on screen'}
                </button>
                {d.status === 'ACTIVE' && (
                  <button type="button" className="btn btn-quiet" onClick={() => setQrFor(d)}>
                    <i aria-hidden className="bi bi-qr-code" /> Show verification code
                  </button>
                )}
              </div>
              {open === d.publicId && <div className="overflow-x-auto">{contents(d) ?? <p className="mt-3 text-sm text-muted">The contents could not be loaded.</p>}</div>}
            </li>
          )
        })}
      </ul>

      {!!followUps.data?.length && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-extrabold">What your doctor recommended</h2>
          <ul className="space-y-3">
            {followUps.data.map((f) => (
              <li key={f.publicId} className="card p-4 text-sm">
                <p className="whitespace-pre-line">{f.recommendation}</p>
                <p className="mt-1 text-xs text-muted">
                  {f.reviewInterval && f.reviewInterval !== 'null' ? `Review in ${f.reviewInterval}. ` : ''}
                  {f.preferredDate ? `Suggested date ${f.preferredDate}. ` : ''}Written {formatDateTime(f.createdAt)}.
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-8">
        <h2 className="mb-3 text-xl font-extrabold">Files you sent</h2>
        <div className="card p-4">
          {files.isLoading ? <Spinner /> : <FileList rows={files.data ?? []} onChanged={() => void qc.invalidateQueries({ queryKey: ['my-files'] })} />}
          <p className="mt-2 text-xs text-muted">Attach a result from the appointment it belongs to.</p>
        </div>
      </section>

      {confirming && (
        <Dialog
          open
          onClose={() => setConfirming(null)}
          busy={downloading}
          title="Download this document?"
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(null)} disabled={downloading}>Not yet</button>
              <button type="button" className="btn btn-primary" onClick={() => download(confirming)} disabled={downloading}>
                {downloading ? <Spinner label="Downloading" inverted /> : 'Download now'}
              </button>
            </>
          }
        >
          <p className="text-sm">
            You can download this <strong>{Math.max(0, confirming.maxDownloads - confirming.downloadCount) === 1 ? 'only once' : 'a limited number of times'}</strong>. Use a good connection, save the file where you can find it, and print it if you need paper.
          </p>
          <p className="mt-3 text-sm text-muted">After that, you can still read it on this page and show the verification code.</p>
        </Dialog>
      )}

      {qrFor && (
        <Dialog open onClose={() => setQrFor(null)} title="Verification code" description="A pharmacist or laboratory scans this to confirm the document is genuine. It does not show what the document says.">
          <QrCode id={qrFor.publicId} label={qrFor.issueNumber ?? qrFor.documentType} />
          <p className="mt-4 text-center text-xs text-muted">Show the code from this page. A screenshot may check as expired.</p>
        </Dialog>
      )}
    </>
  )
}
