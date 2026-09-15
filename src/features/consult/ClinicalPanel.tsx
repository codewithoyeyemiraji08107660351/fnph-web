import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { recordApi } from '@/lib/api/endpoints/clinical'
import { toApiError } from '@/lib/api/http'
import type { ClinicalComponent, ClinicalNote, ConsultationRecord, InvestigationItem, PrescriptionItem } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, humanise } from '@/lib/format'
import { Panel, ErrorState } from '@/components/ui/Page'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const WAIVE_MIN = 10

function useRecord(consultationId: string) {
  return useQuery({ queryKey: ['consult-record', consultationId], queryFn: () => recordApi.record(consultationId) })
}

/* ------------------------------ Note ------------------------------ */

function NoteSection({ consultationId }: { consultationId: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { can } = useAuth()
  const history = useQuery({ queryKey: ['note-history', consultationId], queryFn: () => recordApi.history(consultationId) })
  const current: ClinicalNote | undefined = history.data?.find((n) => !n.supersededAt) ?? history.data?.[history.data.length - 1]
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const [amending, setAmending] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!dirty && current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(current.clinicalNote)
    }
  }, [current, dirty])

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['note-history', consultationId] })
    await qc.invalidateQueries({ queryKey: ['consult-record', consultationId] })
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await recordApi.save(consultationId, draft)
      setDirty(false)
      await refresh()
      toast('Note saved.')
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setSaving(false)
    }
  }

  if (history.isLoading) return <Panel title="Consultation note"><Spinner label="Loading the note" /></Panel>
  if (history.isError) return <Panel title="Consultation note"><ErrorState error={history.error} onRetry={() => history.refetch()} /></Panel>

  const signed = Boolean(current?.signedAt)
  const versions = [...(history.data ?? [])].sort((a, b) => b.version - a.version)

  return (
    <Panel
      title={<span>Consultation note {current && <span className="ml-1 text-xs font-normal text-muted">version {current.version}</span>}</span>}
      action={signed ? <Badge tone="green">Signed</Badge> : current ? <Badge tone="gold">Draft</Badge> : <Badge>Not started</Badge>}
    >
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {signed && current ? (
        <>
          <div className="rounded-[14px] border border-line bg-canvas p-4 text-sm leading-relaxed whitespace-pre-line">{current.clinicalNote}</div>
          <p className="mt-2 text-xs text-muted">
            Signed by {current.signedBy} on {formatDateTime(current.signedAt)}.
            {current.amendmentReason && ` Amended: ${current.amendmentReason}`}
          </p>
          {(current.followUpRecommendation || current.followUpTimeline) && (
            <p className="mt-2 text-sm"><strong>Next:</strong> {current.followUpRecommendation} {current.followUpTimeline && `(${current.followUpTimeline})`}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {can('clinical_note.sign') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAmending(true)}>Amend</button>}
            {versions.length > 1 && (
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowHistory((v) => !v)}>
                {showHistory ? 'Hide versions' : `All ${versions.length} versions`}
              </button>
            )}
          </div>
          {showHistory && (
            <ol className="mt-4 space-y-3">
              {versions.map((v) => (
                <li key={v.publicId} className="rounded-[12px] border border-line p-3 text-sm">
                  <p className="text-xs font-bold text-muted">
                    Version {v.version}. {v.signedAt ? `Signed ${formatDateTime(v.signedAt)} by ${v.signedBy}` : 'Unsigned'}
                    {v.supersededAt && `. Replaced ${formatDateTime(v.supersededAt)}`}
                  </p>
                  {v.amendmentReason && <p className="text-xs text-muted">Reason: {v.amendmentReason}</p>}
                  <p className="mt-1 line-clamp-4 whitespace-pre-line">{v.clinicalNote}</p>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <>
          <TextAreaField
            label="Note"
            rows={12}
            maxLength={50_000}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setDirty(true)
            }}
            hint="Pharmacy and the laboratory never see this note."
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-secondary" disabled={saving || !draft.trim() || !dirty} onClick={save}>
              {saving ? <Spinner label="Saving" /> : 'Save draft'}
            </button>
            {can('clinical_note.sign') && (
              <button type="button" className="btn btn-primary" disabled={!draft.trim() || dirty || !current} onClick={() => setSigning(true)}>
                Sign the note
              </button>
            )}
            {dirty && <span className="text-xs text-gold-700">Unsaved changes. Save before signing.</span>}
          </div>
        </>
      )}

      {signing && <SignDialog consultationId={consultationId} onClose={() => setSigning(false)} onSigned={async () => { setSigning(false); await refresh(); toast('Signed. The note can now only be amended.') }} />}
      {amending && current && (
        <AmendDialog
          consultationId={consultationId}
          current={current.clinicalNote}
          onClose={() => setAmending(false)}
          onAmended={async () => {
            setAmending(false)
            await refresh()
            toast('Amended. The previous version stays in the record.')
          }}
        />
      )}
    </Panel>
  )
}

function SignDialog({ consultationId, onClose, onSigned }: { consultationId: string; onClose: () => void; onSigned: () => void }) {
  const [recommendation, setRecommendation] = useState('')
  const [timeline, setTimeline] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title="Sign the note?"
      description="A signed note cannot be edited. Changes after this are amendments, and every version stays in the record."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Not yet</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await recordApi.sign(consultationId, { followUpRecommendation: recommendation.trim() || undefined, followUpTimeline: timeline.trim() || undefined })
                onSigned()
              } catch (err) {
                setError(toApiError(err).message)
                setBusy(false)
              }
            }}
          >
            {busy ? <Spinner label="Signing" inverted /> : 'Sign'}
          </button>
        </>
      }
    >
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <TextAreaField label="What should happen next (optional)" rows={2} maxLength={2000} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="Continue current treatment. Review mood and sleep." />
      <TextField wrapperClassName="mt-4" label="When (optional)" maxLength={100} value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="6 weeks" />
    </Dialog>
  )
}

function AmendDialog({ consultationId, current, onClose, onAmended }: { consultationId: string; current: string; onClose: () => void; onAmended: () => void }) {
  const [text, setText] = useState(current)
  const unchanged = text.trim() === current.trim()
  return (
    <ReasonDialog
      title="Amend the signed note"
      description="This creates a new version. The signed version stays in the record with your reason."
      label="Why are you amending it?"
      placeholder="Corrected the dose discussed in the session."
      confirmLabel={unchanged ? 'Change the text first' : 'Save amendment'}
      min={WAIVE_MIN}
      onClose={onClose}
      onConfirm={async (reason) => {
        if (unchanged) throw new Error('The amended text is the same as the signed note.')
        await recordApi.amend(consultationId, { clinicalNote: text, amendmentReason: reason })
        onAmended()
      }}
    >
      <TextAreaField label="Amended note" rows={10} maxLength={50_000} value={text} onChange={(e) => setText(e.target.value)} wrapperClassName="mb-4" />
    </ReasonDialog>
  )
}

/* --------------------------- Components --------------------------- */

function componentState(record: ConsultationRecord | undefined, type: ClinicalComponent) {
  return record?.components.find((c) => c.componentType === type)
}

function Waive({ consultationId, component, label, onDone }: { consultationId: string; component: ClinicalComponent; label: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <ReasonDialog
          title={label}
          description="Recording this is what lets the bundle release without waiting for a document nobody will write."
          label="Why is it not needed?"
          placeholder="No change to medication at this review."
          confirmLabel="Record as not needed"
          min={WAIVE_MIN}
          onClose={() => setOpen(false)}
          onConfirm={async (reason) => {
            await recordApi.notRequired(consultationId, component, reason)
            setOpen(false)
            onDone()
          }}
        />
      )}
    </>
  )
}

const EMPTY_RX: PrescriptionItem = { medication: '', strength: '', frequency: '', duration: '', instructions: '' }

function PrescriptionItemsEditor({ items, onChange }: { items: PrescriptionItem[]; onChange: (items: PrescriptionItem[]) => void }) {
  const set = (i: number, key: keyof PrescriptionItem, value: string) => onChange(items.map((it, n) => (n === i ? { ...it, [key]: value } : it)))
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <fieldset key={i} className="rounded-[14px] border border-line p-3">
          <legend className="flex items-center gap-2 px-1 text-xs font-bold text-muted">
            Item {i + 1}
            {items.length > 1 && (
              <button type="button" className="text-alarm" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label={`Remove item ${i + 1}`}>
                <i aria-hidden className="bi bi-x-circle" />
              </button>
            )}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField wrapperClassName="sm:col-span-2" label="Medicine" maxLength={200} value={it.medication} onChange={(e) => set(i, 'medication', e.target.value)} />
            <TextField label="Strength" maxLength={100} placeholder="50 mg" value={it.strength} onChange={(e) => set(i, 'strength', e.target.value)} />
            <TextField label="Frequency" maxLength={100} placeholder="Once daily, at night" value={it.frequency} onChange={(e) => set(i, 'frequency', e.target.value)} />
            <TextField label="Duration" maxLength={100} placeholder="28 days" value={it.duration} onChange={(e) => set(i, 'duration', e.target.value)} />
            <TextField label="Instructions (optional)" maxLength={1000} placeholder="Take with food" value={it.instructions ?? ''} onChange={(e) => set(i, 'instructions', e.target.value)} />
          </div>
        </fieldset>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...items, { ...EMPTY_RX }])}>
        <i aria-hidden className="bi bi-plus" /> Add a medicine
      </button>
    </div>
  )
}

const rxValid = (items: PrescriptionItem[]) => items.length > 0 && items.every((i) => i.medication.trim() && i.strength.trim() && i.frequency.trim() && i.duration.trim())
const cleanRx = (items: PrescriptionItem[]) =>
  items.map((i) => ({ medication: i.medication.trim(), strength: i.strength.trim(), frequency: i.frequency.trim(), duration: i.duration.trim(), instructions: i.instructions?.trim() || undefined }))

function PrescriptionSection({ consultationId, record, onChanged }: { consultationId: string; record?: ConsultationRecord; onChanged: () => void }) {
  const toast = useToast()
  const { can } = useAuth()
  const [items, setItems] = useState<PrescriptionItem[]>([{ ...EMPTY_RX }])
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [superseding, setSuperseding] = useState<string | null>(null)
  const state = componentState(record, 'PRESCRIPTION')
  const live = (record?.prescriptions ?? []).filter((p) => p.status !== 'SUPERSEDED' && p.status !== 'NOT_REQUIRED')

  const issue = async () => {
    setBusy(true)
    setError(null)
    try {
      const doc = await recordApi.issuePrescription(consultationId, { clinicalInformation: info.trim() || undefined, items: cleanRx(items) })
      toast(`Prescription ${doc.issueNumber ?? ''} issued for pharmacy review.`)
      setItems([{ ...EMPTY_RX }])
      setInfo('')
      onChanged()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Prescription" action={<ComponentBadge state={state} issued={live.length > 0} />}>
      {state?.notRequired ? (
        <p className="text-sm text-muted">Recorded as not needed: {state.notRequiredReason}</p>
      ) : live.length > 0 ? (
        <ul className="space-y-2">
          {live.map((p) => (
            <li key={p.publicId} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-line px-3 py-2 text-sm">
              <span>
                <strong>{p.issueNumber ?? 'Prescription'}</strong> <span className="text-muted">{p.itemCount} item{p.itemCount === 1 ? '' : 's'}. {humanise(p.status)}{p.supersedesAnother ? '. Corrects an earlier one' : ''}</span>
              </span>
              {can('prescription.write') && (
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setSuperseding(p.publicId)}>Correct it</button>
              )}
            </li>
          ))}
        </ul>
      ) : can('prescription.write') ? (
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <PrescriptionItemsEditor items={items} onChange={setItems} />
          <TextAreaField
            label="Information for the pharmacist (optional)"
            rows={2}
            maxLength={4000}
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            placeholder="Depressive episode, first-line treatment. No known allergies."
            hint="The pharmacist sees only this, never the consultation note. Write what they need to check the prescription."
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={busy || !rxValid(items)} onClick={issue}>
              {busy ? <Spinner label="Issuing" inverted /> : 'Issue prescription'}
            </button>
            {can('clinical_note.sign') && <Waive consultationId={consultationId} component="PRESCRIPTION" label="No prescription needed" onDone={onChanged} />}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Nothing issued yet.</p>
      )}
      {superseding && (
        <SupersedeDialog consultationId={consultationId} prescriptionId={superseding} onClose={() => setSuperseding(null)} onDone={() => { setSuperseding(null); toast('Corrected prescription issued. The earlier one is replaced.'); onChanged() }} />
      )}
    </Panel>
  )
}

function SupersedeDialog({ consultationId, prescriptionId, onClose, onDone }: { consultationId: string; prescriptionId: string; onClose: () => void; onDone: () => void }) {
  const [items, setItems] = useState<PrescriptionItem[]>([{ ...EMPTY_RX }])
  const [info, setInfo] = useState('')
  return (
    <ReasonDialog
      title="Issue a corrected prescription"
      description="Nothing is edited in place. The corrected prescription replaces the earlier one and goes back through pharmacy review."
      label="Why is it being corrected?"
      placeholder="Dose changed after the pharmacist's query."
      confirmLabel="Issue correction"
      min={WAIVE_MIN}
      onClose={onClose}
      onConfirm={async (reason) => {
        if (!rxValid(items)) throw new Error('Complete every medicine line first.')
        await recordApi.supersedePrescription(consultationId, prescriptionId, { reason, clinicalInformation: info.trim() || undefined, items: cleanRx(items) })
        onDone()
      }}
    >
      <PrescriptionItemsEditor items={items} onChange={setItems} />
      <TextAreaField wrapperClassName="my-4" label="Information for the pharmacist (optional)" rows={2} maxLength={4000} value={info} onChange={(e) => setInfo(e.target.value)} />
    </ReasonDialog>
  )
}

function InvestigationSection({ consultationId, record, onChanged }: { consultationId: string; record?: ConsultationRecord; onChanged: () => void }) {
  const toast = useToast()
  const { can } = useAuth()
  const [items, setItems] = useState<InvestigationItem[]>([{ panelName: '', panelCode: '', notes: '' }])
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const state = componentState(record, 'INVESTIGATION')
  const live = (record?.investigations ?? []).filter((p) => p.status !== 'SUPERSEDED' && p.status !== 'NOT_REQUIRED')
  const set = (i: number, key: keyof InvestigationItem, value: string) => setItems(items.map((it, n) => (n === i ? { ...it, [key]: value } : it)))
  const valid = items.length > 0 && items.every((i) => i.panelName.trim())

  return (
    <Panel title="Investigations" action={<ComponentBadge state={state} issued={live.length > 0} />}>
      {state?.notRequired ? (
        <p className="text-sm text-muted">Recorded as not needed: {state.notRequiredReason}</p>
      ) : live.length > 0 ? (
        <ul className="space-y-2">
          {live.map((p) => (
            <li key={p.publicId} className="rounded-[12px] border border-line px-3 py-2 text-sm">
              <strong>{p.issueNumber ?? 'Request'}</strong> <span className="text-muted">{p.itemCount} panel{p.itemCount === 1 ? '' : 's'}. {humanise(p.status)}</span>
            </li>
          ))}
        </ul>
      ) : can('investigation.write') ? (
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          {items.map((it, i) => (
            <fieldset key={i} className="grid gap-3 rounded-[14px] border border-line p-3 sm:grid-cols-[2fr_1fr]">
              <legend className="flex items-center gap-2 px-1 text-xs font-bold text-muted">
                Panel {i + 1}
                {items.length > 1 && (
                  <button type="button" className="text-alarm" onClick={() => setItems(items.filter((_, n) => n !== i))} aria-label={`Remove panel ${i + 1}`}>
                    <i aria-hidden className="bi bi-x-circle" />
                  </button>
                )}
              </legend>
              <TextField label="Test" maxLength={200} placeholder="Full blood count" value={it.panelName} onChange={(e) => set(i, 'panelName', e.target.value)} />
              <TextField label="Code (optional)" maxLength={50} placeholder="FBC" value={it.panelCode ?? ''} onChange={(e) => set(i, 'panelCode', e.target.value)} />
              <TextField wrapperClassName="sm:col-span-2" label="Notes (optional)" maxLength={1000} value={it.notes ?? ''} onChange={(e) => set(i, 'notes', e.target.value)} />
            </fieldset>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems([...items, { panelName: '', panelCode: '', notes: '' }])}>
            <i aria-hidden className="bi bi-plus" /> Add a test
          </button>
          <TextAreaField label="Information for the laboratory (optional)" rows={2} maxLength={4000} value={info} onChange={(e) => setInfo(e.target.value)} hint="The technician sees only this, never the consultation note." />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !valid}
              onClick={async () => {
                setBusy(true)
                setError(null)
                try {
                  const doc = await recordApi.issueInvestigation(consultationId, {
                    clinicalInformation: info.trim() || undefined,
                    items: items.map((i) => ({ panelName: i.panelName.trim(), panelCode: i.panelCode?.trim() || undefined, notes: i.notes?.trim() || undefined })),
                  })
                  toast(`Request ${doc.issueNumber ?? ''} sent for laboratory review.`)
                  onChanged()
                } catch (err) {
                  setError(toApiError(err).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? <Spinner label="Sending" inverted /> : 'Request investigations'}
            </button>
            {can('clinical_note.sign') && <Waive consultationId={consultationId} component="INVESTIGATION" label="No investigations needed" onDone={onChanged} />}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Nothing requested yet.</p>
      )}
    </Panel>
  )
}

function FollowUpSection({ consultationId, record, onChanged }: { consultationId: string; record?: ConsultationRecord; onChanged: () => void }) {
  const toast = useToast()
  const { can } = useAuth()
  const [recommendation, setRecommendation] = useState('')
  const [interval, setInterval] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const state = componentState(record, 'FOLLOW_UP')
  const done = record?.followUps ?? []

  return (
    <Panel title="Follow-up" action={<ComponentBadge state={state} issued={done.length > 0} />}>
      {state?.notRequired ? (
        <p className="text-sm text-muted">Recorded as not needed: {state.notRequiredReason}</p>
      ) : done.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {done.map((f) => (
            <li key={f.publicId} className="rounded-[12px] border border-line px-3 py-2">
              {f.recommendation} {f.reviewInterval && <span className="text-muted">({f.reviewInterval})</span>}
            </li>
          ))}
        </ul>
      ) : can('follow_up.write') ? (
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <TextAreaField label="Recommendation" rows={2} maxLength={4000} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="Review in six weeks with the same clinician." />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Interval (optional)" maxLength={100} placeholder="6 weeks" value={interval} onChange={(e) => setInterval(e.target.value)} />
            <TextField label="Preferred date (optional)" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !recommendation.trim()}
              onClick={async () => {
                setBusy(true)
                setError(null)
                try {
                  await recordApi.followUp(consultationId, { recommendation: recommendation.trim(), reviewInterval: interval.trim() || undefined, preferredDate: date || undefined })
                  toast('Follow-up recorded.')
                  onChanged()
                } catch (err) {
                  setError(toApiError(err).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? <Spinner label="Saving" inverted /> : 'Record follow-up'}
            </button>
            {can('clinical_note.sign') && <Waive consultationId={consultationId} component="FOLLOW_UP" label="No follow-up needed" onDone={onChanged} />}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Nothing recorded yet.</p>
      )}
    </Panel>
  )
}

function ComponentBadge({ state, issued }: { state?: ConsultationRecord['components'][number]; issued: boolean }) {
  if (state?.notRequired) return <Badge>Not needed</Badge>
  if (state?.complete) return <Badge tone="green">Complete</Badge>
  if (issued) return <Badge tone="navy">In review</Badge>
  return <Badge tone="gold">Outstanding</Badge>
}

export function ClinicalPanel({ consultationId }: { consultationId: string }) {
  const qc = useQueryClient()
  const record = useRecord(consultationId)
  const refresh = () => void qc.invalidateQueries({ queryKey: ['consult-record', consultationId] })
  const outstanding = (record.data?.components ?? []).filter((c) => !c.settled).map((c) => humanise(c.componentType))

  return (
    <div className="space-y-5">
      {record.isError && <ErrorState error={record.error} onRetry={() => record.refetch()} />}
      {record.data && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-white px-4 py-3 text-sm shadow-[var(--shadow-card)]">
          <span>
            <strong>Release</strong>{' '}
            {record.data.bundle ? (outstanding.length ? `waiting on ${outstanding.join(', ')}` : 'everything is settled') : 'starts once something is recorded'}
          </span>
          {record.data.bundle && <Badge tone={outstanding.length ? 'gold' : 'green'}>{humanise(record.data.bundle.status)}</Badge>}
        </div>
      )}
      <NoteSection consultationId={consultationId} />
      <PrescriptionSection consultationId={consultationId} record={record.data} onChanged={refresh} />
      <InvestigationSection consultationId={consultationId} record={record.data} onChanged={refresh} />
      <FollowUpSection consultationId={consultationId} record={record.data} onChanged={refresh} />
    </div>
  )
}
