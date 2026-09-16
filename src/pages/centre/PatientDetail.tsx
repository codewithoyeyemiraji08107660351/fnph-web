import { useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { centreApi } from '@/lib/api/endpoints/centre'
import { toApiError } from '@/lib/api/http'
import type { CentrePatientRow, CentreReferral } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatCalendarDate, formatDateTime, formatPhone } from '@/lib/format'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { SelectField, TextAreaField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { ReferralStatusBadge } from './ReferralStatusBadge'
import { ConsentSubmitDialog, RequestTimeDialog } from './ReferralDialogs'

const REASON_MIN = 20

function NewReferral({ patientId, onCreated }: { patientId: string; onCreated: (r: CentreReferral) => void }) {
  const [f, setF] = useState({ referralReason: '', assessment: '', currentCondition: '', relevantMedicines: '', previousResults: '', urgency: 'ROUTINE' as 'ROUTINE' | 'SOON' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) => setF((v) => ({ ...v, [k]: e.target.value }))
  const short = f.referralReason.trim().length < REASON_MIN
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (short) return setError(`Describe the reason in at least ${REASON_MIN} characters. It is the only clinical context the FNPH doctor receives.`)
    setBusy(true)
    setError(null)
    try {
      const r = await centreApi.createReferral({
        centrePatientPublicId: patientId,
        referralReason: f.referralReason.trim(),
        assessment: f.assessment.trim() || undefined,
        currentCondition: f.currentCondition.trim() || undefined,
        relevantMedicines: f.relevantMedicines.trim() || undefined,
        previousResults: f.previousResults.trim() || undefined,
        urgency: f.urgency,
      })
      setF({ referralReason: '', assessment: '', currentCondition: '', relevantMedicines: '', previousResults: '', urgency: 'ROUTINE' })
      onCreated(r)
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <TextAreaField
        label="Reason for referral"
        rows={4}
        maxLength={4000}
        value={f.referralReason}
        onChange={set('referralReason')}
        hint={`The FNPH doctor has no hospital record for this patient, so write what they need to know. ${short ? `At least ${REASON_MIN - f.referralReason.trim().length} more characters.` : ''}`}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextAreaField label="Assessment at the centre (optional)" rows={2} maxLength={4000} value={f.assessment} onChange={set('assessment')} />
        <TextAreaField label="Current condition (optional)" rows={2} maxLength={4000} value={f.currentCondition} onChange={set('currentCondition')} />
        <TextAreaField label="Medicines being taken (optional)" rows={2} maxLength={4000} value={f.relevantMedicines} onChange={set('relevantMedicines')} />
        <TextAreaField label="Previous results (optional)" rows={2} maxLength={4000} value={f.previousResults} onChange={set('previousResults')} />
      </div>
      <SelectField label="Urgency" value={f.urgency} onChange={set('urgency')} hint="Not for emergencies. A patient at immediate risk needs emergency care now.">
        <option value="ROUTINE">Routine</option>
        <option value="SOON">Soon</option>
      </SelectField>
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Saving" inverted /> : 'Save referral'}</button>
      <p className="text-xs text-muted">Saving keeps it as a draft. Consent is taken with the patient before it is sent.</p>
    </form>
  )
}

export function PatientDetail() {
  const { patientId = '' } = useParams()
  const state = useLocation().state as { patient?: CentrePatientRow } | null
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()
  const all = useQuery({ queryKey: ['centre-patients', ''], queryFn: () => centreApi.patients(), enabled: !state?.patient })
  const patient = state?.patient ?? all.data?.find((p) => p.publicId === patientId)
  const referrals = useQuery({ queryKey: ['centre-patient-referrals', patientId], queryFn: () => centreApi.patientReferrals(patientId) })
  const [consenting, setConsenting] = useState<CentreReferral | null>(null)
  const [requesting, setRequesting] = useState<CentreReferral | null>(null)
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['centre-patient-referrals', patientId] })
    void qc.invalidateQueries({ queryKey: ['centre-referrals'] })
  }
  if (!patient && all.isLoading) return <Spinner />
  return (
    <>
      <Link to="/centre/patients" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold no-underline"><i aria-hidden className="bi bi-arrow-left" /> Patients</Link>
      <PageHeader
        kicker="Centre patient"
        title={patient?.name ?? 'Patient'}
        description={patient ? `Born ${formatCalendarDate(patient.dateOfBirth)}. ${formatPhone(patient.phoneNumber)}.` : undefined}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <Panel title="Referrals" bodyClassName="">
          {referrals.isLoading && <div className="p-5"><Spinner /></div>}
          {referrals.isError && <ErrorState error={referrals.error} onRetry={() => referrals.refetch()} />}
          {referrals.data?.length === 0 && <p className="px-5 py-4 text-sm text-muted">No referrals yet.</p>}
          <ul className="divide-y divide-line">
            {referrals.data?.map((r) => (
              <li key={r.publicId} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{r.reference}</span>
                  <ReferralStatusBadge status={r.status} />
                </div>
                <p className="text-xs text-muted">
                  Created {formatDateTime(r.createdAt)}.{r.consentWitnessedBy ? ` Consent witnessed by ${r.consentWitnessedBy}, ${formatDateTime(r.consentAcceptedAt)}.` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(r.status === 'DRAFT' || r.status === 'RETURNED') && can('centre_referral.create') && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setConsenting(r)}>Take consent and send</button>
                  )}
                  {r.status === 'SUBMITTED' && can('appointment.request') && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setRequesting(r)}>Request a consultation time</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        {can('centre_referral.create') && (
          <Panel title="New referral">
            <NewReferral patientId={patientId} onCreated={(r) => { toast(`Referral ${r.reference} saved as a draft.`); refresh() }} />
          </Panel>
        )}
      </div>
      {consenting && <ConsentSubmitDialog referral={consenting} onClose={() => setConsenting(null)} onDone={() => { setConsenting(null); toast('Referral sent to FNPH.'); refresh() }} />}
      {requesting && <RequestTimeDialog referral={requesting} onClose={() => setRequesting(null)} onDone={(ref) => { setRequesting(null); toast(`Request ${ref} sent. FNPH will confirm.`); refresh() }} />}
    </>
  )
}
