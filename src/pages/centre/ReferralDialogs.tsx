import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { centreApi } from '@/lib/api/endpoints/centre'
import { toApiError } from '@/lib/api/http'
import type { CentreReferral } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { DISPLAY_TIME_ZONE, formatLongDate, formatTime } from '@/lib/format'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

/**
  Consent is taken for this referral, with the patient present, and witnessed.
  There is no "already consented": agreeing in March is not agreeing in June.
*/
export function ConsentSubmitDialog({ referral, onClose, onDone }: { referral: CentreReferral; onClose: () => void; onDone: () => void }) {
  const { principal } = useAuth()
  const consent = useQuery({ queryKey: ['centre-consent'], queryFn: centreApi.consent, retry: false })
  const [witness, setWitness] = useState(principal?.displayName ?? '')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (!consent.data) return
    setBusy(true)
    setError(null)
    try {
      await centreApi.submitReferral(referral.publicId, consent.data.version, witness.trim())
      onDone()
    } catch (err) {
      setError(toApiError(err).message)
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      busy={busy}
      title={`Consent for ${referral.patientName}`}
      description="Read this to the patient, in a language they understand, before submitting. Their agreement covers this referral only."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy || !consent.data || !agreed || !witness.trim()} onClick={submit}>
            {busy ? <Spinner label="Submitting" inverted /> : 'Submit referral to FNPH'}
          </button>
        </>
      }
    >
      {consent.isLoading && <Spinner label="Loading the consent text" />}
      {consent.isError && (
        <Alert tone="warning" title="No consent text is published for centres">
          {toApiError(consent.error).message} A referral cannot be submitted until FNPH publishes it.
        </Alert>
      )}
      {consent.data && (
        <>
          <p className="text-xs text-muted">{consent.data.title}, version {consent.data.version}</p>
          <div className="mt-2 max-h-[40vh] overflow-y-auto rounded-[14px] border border-line bg-canvas p-4 text-sm leading-relaxed whitespace-pre-line">{consent.data.body}</div>
          {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
          <TextField wrapperClassName="mt-4" label="Witnessed by (centre staff present)" maxLength={100} value={witness} onChange={(e) => setWitness(e.target.value)} />
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>The patient heard this text and agreed to a telepsychiatry consultation for this referral.</span>
          </label>
        </>
      )}
    </Dialog>
  )
}

function watDay(offset: number) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE }).format(new Date(Date.now() + offset * 86_400_000))
}

/** A request, not a booking. FNPH decides, so there is no hold and no countdown. */
export function RequestTimeDialog({ referral, onClose, onDone }: { referral: CentreReferral; onClose: () => void; onDone: (ref: string) => void }) {
  const [date, setDate] = useState(watDay(1))
  const [chosen, setChosen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const times = useQuery({ queryKey: ['centre-times', date], queryFn: () => centreApi.times(date) })
  const days = Array.from({ length: 14 }, (_, i) => watDay(i + 1))
  const submit = async () => {
    if (!chosen) return
    setBusy(true)
    setError(null)
    try {
      const result = await centreApi.requestAppointment(referral.publicId, chosen)
      onDone(result.reference)
    } catch (err) {
      setError(toApiError(err).message)
      setBusy(false)
      void times.refetch()
    }
  }
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      busy={busy}
      title={`Request a consultation for ${referral.patientName}`}
      description="FNPH reviews the request and confirms the doctor and time. The patient needs to be at the centre for the consultation."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy || !chosen} onClick={submit}>{busy ? <Spinner label="Sending" inverted /> : 'Send request'}</button>
        </>
      }
    >
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {days.map((d) => (
          <button key={d} type="button" onClick={() => { setDate(d); setChosen(null) }} aria-pressed={d === date}
            className={`min-w-[62px] rounded-[12px] border px-2 py-2 text-center ${d === date ? 'border-accent bg-accent text-white' : 'border-line bg-white'}`}>
            <span className="block text-[0.65rem] font-bold uppercase">{new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: DISPLAY_TIME_ZONE }).format(new Date(`${d}T12:00:00+01:00`))}</span>
            <span className="block font-display text-lg font-extrabold">{Number(d.slice(8))}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm font-bold">{formatLongDate(new Date(`${date}T12:00:00+01:00`))}</p>
      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
      {times.isLoading && <Spinner className="mt-3" />}
      {times.data?.length === 0 && <p className="mt-3 rounded-[12px] bg-canvas p-3 text-sm text-muted">No centre times are published for this day. That means the day was not opened for centres, not that FNPH is full.</p>}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {times.data?.map((t) => (
          <button key={t.slotPublicId} type="button" aria-pressed={chosen === t.slotPublicId} onClick={() => setChosen(t.slotPublicId)}
            className={`rounded-[12px] border px-2 py-2 font-display font-extrabold ${chosen === t.slotPublicId ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-white'}`}>
            {formatTime(t.startAt)}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Times are WAT.</p>
    </Dialog>
  )
}
