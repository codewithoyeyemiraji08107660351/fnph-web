import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { centreApi } from '@/lib/api/endpoints/centre'
import { toApiError } from '@/lib/api/http'
import type { RegisterCentrePatient } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatCalendarDate, formatPhone } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const EMPTY: RegisterCentrePatient = { centrePatientId: '', firstName: '', lastName: '', middleName: '', dateOfBirth: '', gender: '', phoneNumber: '', email: '', address: '', fnphEhrNumber: '' }

function RegisterDialog({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof RegisterCentrePatient) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!f.firstName.trim() || !f.lastName.trim() || !f.dateOfBirth || !f.phoneNumber.trim()) return setError('Name, date of birth and phone number are required.')
    setBusy(true)
    setError(null)
    try {
      const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || undefined : v])) as unknown as RegisterCentrePatient
      const created = await centreApi.registerPatient(clean)
      onDone(created.publicId)
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
      title="Register a patient at this centre"
      description="This creates the centre’s own record. It does not look up or link any FNPH hospital record."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="register-patient" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Saving" inverted /> : 'Register patient'}</button>
        </>
      }
    >
      <form id="register-patient" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
        <TextField label="First name" maxLength={100} value={f.firstName} onChange={set('firstName')} required />
        <TextField label="Last name" maxLength={100} value={f.lastName} onChange={set('lastName')} required />
        <TextField label="Middle name (optional)" maxLength={100} value={f.middleName} onChange={set('middleName')} />
        <TextField label="Date of birth" type="date" value={f.dateOfBirth} onChange={set('dateOfBirth')} required />
        <SelectField label="Sex (optional)" value={f.gender} onChange={set('gender')}>
          <option value="">Not recorded</option>
          <option value="FEMALE">Female</option>
          <option value="MALE">Male</option>
        </SelectField>
        <TextField label="Phone number" type="tel" maxLength={20} value={f.phoneNumber} onChange={set('phoneNumber')} required />
        <TextField label="Email (optional)" type="email" maxLength={100} value={f.email} onChange={set('email')} />
        <TextField label="Centre patient number (optional)" maxLength={50} value={f.centrePatientId} onChange={set('centrePatientId')} />
        <TextAreaField wrapperClassName="sm:col-span-2" label="Address (optional)" rows={2} maxLength={500} value={f.address} onChange={set('address')} />
        <TextField
          wrapperClassName="sm:col-span-2"
          label="FNPH hospital number, if the patient has one (optional)"
          maxLength={50}
          value={f.fnphEhrNumber}
          onChange={set('fnphEhrNumber')}
          hint="A reference the clinician can quote. The hospital record is not retrieved, so the referral must carry the clinical context."
        />
      </form>
    </Dialog>
  )
}

export function Patients() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [term, setTerm] = useState('')
  const [applied, setApplied] = useState('')
  const [registering, setRegistering] = useState(false)
  const list = useQuery({ queryKey: ['centre-patients', applied], queryFn: () => centreApi.patients(applied) })
  return (
    <>
      <PageHeader
        kicker="Centre"
        title="Patients"
        description="People registered at this centre. Open a patient to refer them to FNPH."
        actions={can('centre_patient.create') && <button type="button" className="btn btn-primary" onClick={() => setRegistering(true)}><i aria-hidden className="bi bi-person-plus" /> Register a patient</button>}
      />
      <Panel bodyClassName="">
        <form className="flex gap-2 border-b border-line p-4" onSubmit={(e) => { e.preventDefault(); setApplied(term.trim()) }}>
          <label className="relative flex-1">
            <span className="sr-only">Search patients</span>
            <i aria-hidden className="bi bi-search absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
            <input className="input pl-10" placeholder="Name, phone or centre number" value={term} onChange={(e) => setTerm(e.target.value)} />
          </label>
          <button className="btn btn-secondary" type="submit">Search</button>
        </form>
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {list.data?.length === 0 && <EmptyState icon="bi-people" title={applied ? 'No patients match' : 'No patients registered yet'} />}
        <ul className="divide-y divide-line">
          {list.data?.map((p) => (
            <li key={p.publicId}>
              <Link to={`/centre/patients/${encodeURIComponent(p.publicId)}`} state={{ patient: p }} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-ink no-underline hover:bg-soft/60">
                <span>
                  <span className="block font-bold">{p.name}</span>
                  <span className="block text-xs text-muted">
                    Born {formatCalendarDate(p.dateOfBirth)}. {formatPhone(p.phoneNumber)}{p.centrePatientId ? `. ${p.centrePatientId}` : ''}
                  </span>
                </span>
                <i aria-hidden className="bi bi-chevron-right text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
      {registering && (
        <RegisterDialog
          onClose={() => setRegistering(false)}
          onDone={() => {
            setRegistering(false)
            toast('Patient registered.')
            void qc.invalidateQueries({ queryKey: ['centre-patients'] })
          }}
        />
      )}
    </>
  )
}
