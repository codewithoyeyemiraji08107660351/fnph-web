import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { oversightApi } from '@/lib/api/endpoints/hub'
import { toApiError } from '@/lib/api/http'
import type { FollowUpMode, FollowUpStatus, HubFollowUpRow } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatCalendarDate, humanise } from '@/lib/format'

import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { ReasonField, SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { EmptyState, ErrorState, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

import { oversightKeys, REASON_MIN, useRefreshOversight } from './oversight'

/** The hub may move a follow-up between these. NOT_REQUIRED is the doctor's call. */
const HUB_STATUSES: FollowUpStatus[] = ['RECOMMENDED', 'SCHEDULED', 'COMPLETED', 'CANCELLED']
const MODES: FollowUpMode[] = ['VIDEO', 'AUDIO', 'PHONE_FALLBACK']

const todayInLagos = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())

function StatusBadge({ status }: { status: FollowUpStatus }) {
  switch (status) {
    case 'COMPLETED':
      return <Badge tone="green">Completed</Badge>
    case 'SCHEDULED':
      return <Badge tone="navy">Scheduled</Badge>
    case 'RECOMMENDED':
      return <Badge tone="gold">To schedule</Badge>
    case 'CANCELLED':
      return <Badge tone="red">Cancelled</Badge>
    case 'NOT_REQUIRED':
      return <Badge>Not required</Badge>
  }
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={value ? 'text-sm' : 'text-sm text-muted'}>{value || 'Not set'}</dd>
    </div>
  )
}

/** Client-side mirror of the server rules, so the button explains itself. */
function problemWith(form: Form): string | null {
  if (form.status === 'SCHEDULED' && !form.scheduledDate) return 'A scheduled follow-up needs a scheduled date.'
  if (form.status === 'COMPLETED' && !form.completedDate) return 'A completed follow-up needs a completed date.'
  if (form.completedDate && form.completedDate > todayInLagos()) return 'The completed date cannot be in the future.'
  return null
}

interface Form {
  preferredDate: string
  preferredTime: string
  consultationMode: FollowUpMode
  status: FollowUpStatus
  scheduledDate: string
  completedDate: string
  notes: string
}

function formOf(f: HubFollowUpRow): Form {
  return {
    preferredDate: f.preferredDate ?? '',
    preferredTime: f.preferredTime?.slice(0, 5) ?? '',
    consultationMode: f.consultationMode ?? 'VIDEO',
    status: f.status,
    scheduledDate: f.scheduledDate ?? '',
    completedDate: f.completedDate ?? '',
    notes: f.notes ?? '',
  }
}

function EditFollowUpDialog({
  appointmentPublicId,
  followUp,
  onClose,
}: {
  appointmentPublicId: string
  followUp: HubFollowUpRow
  onClose: () => void
}) {
  const toast = useToast()
  const refresh = useRefreshOversight(appointmentPublicId)
  const initial = formOf(followUp)
  const [form, setForm] = useState<Form>(initial)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))
  const unchanged = JSON.stringify({ ...form, notes: form.notes.trim() }) === JSON.stringify({ ...initial, notes: initial.notes.trim() })
  const problem = problemWith(form)
  const reasonShort = reason.trim().length < REASON_MIN

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await oversightApi.editFollowUp(appointmentPublicId, followUp.followUpPublicId, {
        preferredDate: form.preferredDate || null,
        preferredTime: form.preferredTime ? `${form.preferredTime}:00` : null,
        consultationMode: form.consultationMode,
        status: form.status,
        scheduledDate: form.scheduledDate || null,
        completedDate: form.completedDate || null,
        notes: form.notes.trim() || null,
        reason: reason.trim(),
        expectedUpdatedAt: followUp.updatedAt ?? null,
      })
      await refresh()
      toast('Follow-up updated.')
      onClose()
    } catch (e) {
      const apiError = toApiError(e)
      setError(apiError.message)
      if (apiError.status === 409) await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      size="lg"
      title="Edit follow-up scheduling"
      description="The doctor's recommendation stays as written. Your change and reason are kept in the edit history."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={busy || unchanged || reasonShort || Boolean(problem)}
          >
            {busy ? 'Saving' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        {followUp.recommendation && (
          <div className="rounded-lg border border-line bg-surface px-3 py-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Doctor's recommendation</p>
            <p className="mt-1 whitespace-pre-wrap">{followUp.recommendation}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Status" value={form.status} onChange={(e) => set('status', e.target.value as FollowUpStatus)}>
            {HUB_STATUSES.map((s) => (
              <option key={s} value={s}>{humanise(s)}</option>
            ))}
          </SelectField>
          <SelectField label="Mode" value={form.consultationMode} onChange={(e) => set('consultationMode', e.target.value as FollowUpMode)}>
            {MODES.map((m) => (
              <option key={m} value={m}>{humanise(m)}</option>
            ))}
          </SelectField>
          <TextField label="Preferred date" type="date" value={form.preferredDate} onChange={(e) => set('preferredDate', e.target.value)} />
          <TextField label="Preferred time (WAT)" type="time" value={form.preferredTime} onChange={(e) => set('preferredTime', e.target.value)} />
          <TextField
            label="Scheduled date"
            type="date"
            value={form.scheduledDate}
            onChange={(e) => set('scheduledDate', e.target.value)}
            hint={form.status === 'SCHEDULED' ? 'Required when scheduled.' : undefined}
          />
          <TextField
            label="Completed date"
            type="date"
            max={todayInLagos()}
            value={form.completedDate}
            onChange={(e) => set('completedDate', e.target.value)}
            hint={form.status === 'COMPLETED' ? 'Required when completed.' : undefined}
          />
        </div>

        <TextAreaField
          label="Coordination notes"
          rows={3}
          maxLength={10000}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />

        {problem && <Alert tone="warning">{problem}</Alert>}

        <ReasonField
          value={reason}
          onChange={setReason}
          min={REASON_MIN}
          placeholder="Patient asked to move the review to the following week."
        />
      </div>
    </Dialog>
  )
}

/** The scheduling side of each follow-up. The recommendation itself is the doctor's. */
export function FollowUpsPanel({ appointmentPublicId }: { appointmentPublicId: string }) {
  const { can } = useAuth()
  const [editing, setEditing] = useState<HubFollowUpRow | null>(null)
  const followUps = useQuery({
    queryKey: oversightKeys.followUps(appointmentPublicId),
    queryFn: () => oversightApi.followUps(appointmentPublicId),
  })
  const canEdit = can('hub.clinical_edit')

  return (
    <Panel title="Follow-up scheduling" className="mt-5" bodyClassName="">
      {followUps.isLoading && (
        <div className="p-5">
          <Spinner label="Loading follow-ups" />
        </div>
      )}

      {followUps.isError && <ErrorState error={followUps.error} onRetry={() => followUps.refetch()} />}

      {followUps.isSuccess && followUps.data.length === 0 && (
        <EmptyState icon="bi-calendar-check" title="No follow-up on this consultation" />
      )}

      {!!followUps.data?.length && (
        <ul className="divide-y divide-line">
          {followUps.data.map((f) => (
            <li key={f.followUpPublicId} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-prose whitespace-pre-wrap text-sm">
                  {f.recommendation || 'No recommendation text.'}
                  {(f.reviewInterval || f.expectedTimeframe) && (
                    <span className="mt-1 block text-xs text-muted">
                      {[f.reviewInterval, f.expectedTimeframe].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={f.status} />
                  {canEdit && f.editable && (
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => setEditing(f)}>
                      <i aria-hidden className="bi bi-pencil" /> Edit
                    </button>
                  )}
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                <Detail label="Preferred" value={f.preferredDate ? `${formatCalendarDate(f.preferredDate)}${f.preferredTime ? `, ${f.preferredTime.slice(0, 5)}` : ''}` : null} />
                <Detail label="Mode" value={f.consultationMode ? humanise(f.consultationMode) : null} />
                <Detail label="Scheduled" value={f.scheduledDate ? formatCalendarDate(f.scheduledDate) : null} />
                <Detail label="Completed" value={f.completedDate ? formatCalendarDate(f.completedDate) : null} />
              </dl>

              {f.notes?.trim() && (
                <p className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-surface px-3 py-2 text-sm">{f.notes}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditFollowUpDialog appointmentPublicId={appointmentPublicId} followUp={editing} onClose={() => setEditing(null)} />
      )}
    </Panel>
  )
}
