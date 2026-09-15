import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/lib/api/endpoints/publicInfo'
import type { DocumentVerificationStatus } from '@/lib/api/types'
import { useDocumentTitle } from '@/lib/hooks/useDocumentTitle'
import { formatCalendarDate, humanise } from '@/lib/format'
import { TextField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/Page'

const OUTCOME: Record<DocumentVerificationStatus, { title: string; body: string; box: string; icon: string }> = {
  VALID: { title: 'Genuine and valid', body: 'This document was issued by FNPH Kaduna and is within its validity period. Check the issue number matches the printed copy.', box: 'bg-mint text-forest-900', icon: 'bi-patch-check-fill' },
  EXPIRED: { title: 'Genuine but expired', body: 'This document was issued by FNPH Kaduna but its validity period has ended. Do not dispense or act on it.', box: 'bg-amber-note text-gold-700', icon: 'bi-hourglass-bottom' },
  REVOKED: { title: 'Withdrawn by the hospital', body: 'FNPH Kaduna has revoked this document. It must not be acted on.', box: 'bg-blush text-alarm-700', icon: 'bi-x-octagon-fill' },
  SUPERSEDED: { title: 'Replaced by a corrected version', body: 'A newer version of this document exists. Ask the patient for the current copy.', box: 'bg-amber-note text-gold-700', icon: 'bi-arrow-repeat' },
  NOT_FOUND: { title: 'Not recognised', body: 'No FNPH Kaduna document matches this code. Treat the document as not genuine.', box: 'bg-blush text-alarm-700', icon: 'bi-question-octagon-fill' },
}

export function VerifyDocument() {
  useDocumentTitle('Check a document')
  const { token } = useParams()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const query = useQuery({
    queryKey: ['verify', token],
    queryFn: () => publicApi.verifyDocument(token as string),
    enabled: Boolean(token),
    retry: false,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = input.trim().split('/').filter(Boolean).pop()
    if (value) navigate(`/verify/${encodeURIComponent(value)}`)
  }

  const outcome = query.data ? OUTCOME[query.data.status] ?? OUTCOME.NOT_FOUND : null

  return (
    <div className="mx-auto max-w-xl px-5 py-14">
      <span className="kicker">Document verification</span>
      <h1 className="text-[clamp(1.9rem,4vw,2.6rem)] font-extrabold tracking-[-0.04em]">Check a prescription or investigation request</h1>
      <p className="mt-3 text-muted">Scan the QR code on the document, or paste the verification link below. The check shows only whether the document is genuine, never clinical details.</p>

      {token && (
        <div className="mt-8">
          {query.isLoading && <Spinner label="Checking the document" />}
          {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
          {outcome && query.data && (
            <div className={`rounded-[20px] p-6 ${outcome.box}`} role="status">
              <p className="flex items-center gap-3 font-display text-xl font-extrabold">
                <i aria-hidden className={`bi ${outcome.icon}`} /> {outcome.title}
              </p>
              <p className="mt-2 text-sm">{outcome.body}</p>
              {query.data.issueNumber && (
                <dl className="mt-5 grid grid-cols-2 gap-3 rounded-[14px] bg-white/70 p-4 text-sm text-ink">
                  <div>
                    <dt className="text-xs text-muted">Issue number</dt>
                    <dd className="font-mono font-bold">{query.data.issueNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Document</dt>
                    <dd className="font-bold">{humanise(query.data.documentType)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Issued</dt>
                    <dd>{formatCalendarDate(query.data.issuedOn)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Valid until</dt>
                    <dd>{formatCalendarDate(query.data.expiresOn)}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}
        </div>
      )}

      <form onSubmit={submit} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField wrapperClassName="flex-1" label={token ? 'Check another document' : 'Verification link or code'} value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} autoCapitalize="none" />
        <button className="btn btn-primary" type="submit" disabled={!input.trim()}>
          Check document
        </button>
      </form>
    </div>
  )
}
