import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supportApi, type TicketCategory } from '@/lib/api/endpoints/support'
import { toApiError } from '@/lib/api/http'
import { formatDateTime, formatPhone, humanise } from '@/lib/format'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { TicketStatusBadge, TicketThread } from './TicketThread'

const CATEGORIES: TicketCategory[] = ['ACCESS_AND_SIGN_IN', 'ENROLMENT', 'BOOKING', 'PAYMENT', 'TECHNICAL_FAULT', 'DOCUMENT_ACCESS', 'CLINICAL_CONCERN', 'OTHER']

export function MySupport() {
  const qc = useQueryClient()
  const toast = useToast()
  const { emergencyNumber } = usePublicSettings()
  const mine = useQuery({ queryKey: ['my-tickets'], queryFn: supportApi.mine })
  const [f, setF] = useState({ category: '' as TicketCategory | '', subject: '', body: '', reference: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.category || !f.subject.trim() || !f.body.trim()) return setError('Choose a topic and describe the problem.')
    setBusy(true)
    setError(null)
    try {
      const ref = f.reference.trim() || undefined
      const t = await supportApi.raise({
        category: f.category,
        subject: f.subject.trim(),
        body: f.body.trim(),
        appointmentReference: f.category === 'BOOKING' ? ref : undefined,
        paymentReference: f.category === 'PAYMENT' ? ref : undefined,
        documentNumber: f.category === 'DOCUMENT_ACCESS' ? ref : undefined,
      })
      toast(`Request ${t.ticketNumber} raised. You will be notified of replies.`)
      setF({ category: '', subject: '', body: '', reference: '' })
      await qc.invalidateQueries({ queryKey: ['my-tickets'] })
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }
  const refLabel = f.category === 'BOOKING' ? 'Appointment reference' : f.category === 'PAYMENT' ? 'Payment reference or RRR' : f.category === 'DOCUMENT_ACCESS' ? 'Document number' : null
  return (
    <>
      <PageHeader kicker="Support" title="Get help" description="Raise a problem with the service. Replies come to your notices." />
      <Alert tone="danger" className="mb-5">Not for emergencies or urgent clinical problems. Call <a className="font-bold" href={`tel:${emergencyNumber}`}>{formatPhone(emergencyNumber)}</a>.</Alert>
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Raise a request">
          <form onSubmit={submit} noValidate className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <SelectField label="Topic" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as TicketCategory })}>
              <option value="">Choose one</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{humanise(c)}</option>)}
            </SelectField>
            {f.category === 'CLINICAL_CONCERN' && <Alert tone="warning">Helpdesk staff are not clinicians. If you feel unsafe, call the emergency number above.</Alert>}
            {refLabel && <TextField label={`${refLabel} (optional)`} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />}
            <TextField label="Subject" maxLength={200} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
            <TextAreaField label="What happened?" rows={5} maxLength={4000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} hint="Never include a password or a verification code." />
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Sending" inverted /> : 'Send request'}</button>
          </form>
        </Panel>
        <Panel title="Your requests" bodyClassName="">
          {mine.isLoading && <div className="p-5"><Spinner /></div>}
          {mine.isError && <ErrorState error={mine.error} />}
          {mine.data?.length === 0 && <EmptyState icon="bi-life-preserver" title="No requests yet" />}
          <ul className="divide-y divide-line">
            {mine.data?.map((t) => (
              <li key={t.publicId} className="px-5 py-3">
                <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-left" aria-expanded={open === t.publicId} onClick={() => setOpen(open === t.publicId ? null : t.publicId)}>
                  <span><span className="block font-bold">{t.subject}</span><span className="block text-xs text-muted">{t.ticketNumber}. {formatDateTime(t.createdAt)}</span></span>
                  <TicketStatusBadge status={t.status} />
                </button>
                {open === t.publicId && <div className="mt-3"><TicketThread ticket={t} /></div>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  )
}
