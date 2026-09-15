import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { workQueueApi, type QueueKind } from '@/lib/api/endpoints/clinical'
import { toApiError } from '@/lib/api/http'
import type { WorkQueueRow } from '@/lib/api/types'
import { formatDateTime, formatRelative, parseServerTime } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { WorkStateBadge } from '@/components/ui/AppointmentBadge'
import { Badge } from '@/components/ui/Badge'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { VitalsList } from './VitalsList'
import { useNow } from '@/lib/hooks/useNow'

const COPY: Record<QueueKind, { title: string; description: string; completeLabel: string }> = {
  nursing: {
    title: 'Nursing preparation',
    description: 'Check the patient-reported readings, enter them in the offline EHR, confirm the room, then mark preparation complete.',
    completeLabel: 'Mark preparation complete',
  },
  him: {
    title: 'Record retrieval',
    description: 'Pull or prepare the paper record by EHR number so the doctor has it for the session. The offline record is the authoritative one.',
    completeLabel: 'Mark record ready',
  },
}

function Row({ kind, row, onChanged }: { kind: QueueKind; row: WorkQueueRow; onChanged: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [raising, setRaising] = useState(false)
  const now = useNow(60_000)
  const soon = (parseServerTime(row.appointmentDate)?.getTime() ?? Infinity) - now < 60 * 60_000
  const done = row.state === 'TREATED'

  const act = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await fn()
      toast(message)
      onChanged()
    } catch (err) {
      toast(toApiError(err).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{row.patientName} <span className="font-normal text-muted">EHR {row.ehrNumber}</span></p>
          <p className="text-sm text-muted">
            {formatDateTime(row.appointmentDate)} ({formatRelative(row.appointmentDate)}). {row.room ?? 'No room yet'}. {row.reference}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <WorkStateBadge state={row.state} />
            {kind === 'nursing' && (row.vitalsRecorded ? <Badge tone="green">Readings submitted</Badge> : <Badge tone={soon ? 'red' : 'gold'}>{soon ? 'Readings missing, starts soon' : 'Readings not submitted'}</Badge>)}
          </div>
          {row.exceptionReason && <p className="mt-2 rounded-[10px] bg-blush px-3 py-2 text-sm text-alarm-700">Issue raised: {row.exceptionReason}</p>}
        </div>
        {!done && (
          <div className="flex flex-wrap gap-2">
            {(row.state === 'UNTREATED' || row.state === 'EXCEPTION') && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(() => workQueueApi.start(kind, row.appointmentPublicId), 'Started.')}>
                {row.state === 'EXCEPTION' ? 'Resume' : 'Start'}
              </button>
            )}
            {row.state === 'IN_PROGRESS' && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy || (kind === 'nursing' && (!row.vitalsRecorded || !row.room))}
                title={kind === 'nursing' && !row.vitalsRecorded ? 'Readings are required first' : kind === 'nursing' && !row.room ? 'A room is required first' : undefined}
                onClick={() => act(() => workQueueApi.complete(kind, row.appointmentPublicId), 'Marked complete.')}
              >
                {COPY[kind].completeLabel}
              </button>
            )}
            <button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={() => setRaising(true)}>Raise an issue</button>
          </div>
        )}
      </div>
      {kind === 'nursing' && (
        <>
          <button type="button" className="btn btn-quiet btn-sm mt-2 -ml-3" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <i aria-hidden className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'}`} /> {open ? 'Hide readings' : 'Show readings'}
          </button>
          {open && <div className="mt-2"><VitalsList appointmentPublicId={row.appointmentPublicId} /></div>}
        </>
      )}
      {raising && (
        <ReasonDialog
          title={`Raise an issue on ${row.reference}`}
          description="This flags the appointment for the Hub Coordinator instead of completing it."
          label="What is blocking this?"
          placeholder={kind === 'nursing' ? 'Patient has not submitted readings and is not answering the phone.' : 'No paper record found under this EHR number.'}
          confirmLabel="Raise issue"
          min={5}
          onClose={() => setRaising(false)}
          onConfirm={async (reason) => {
            await workQueueApi.exception(kind, row.appointmentPublicId, reason)
            toast('Issue raised with the Hub Coordinator.')
            setRaising(false)
            onChanged()
          }}
        />
      )}
    </li>
  )
}

export function WorkQueue({ kind }: { kind: QueueKind }) {
  const qc = useQueryClient()
  const queue = useQuery({ queryKey: ['work-queue', kind], queryFn: () => workQueueApi.list(kind), refetchInterval: 60_000 })
  const rows = queue.data ?? []
  const open = rows.filter((r) => r.state !== 'TREATED')
  const done = rows.filter((r) => r.state === 'TREATED')
  const refresh = () => void qc.invalidateQueries({ queryKey: ['work-queue', kind] })

  return (
    <>
      <PageHeader kicker="Assigned to you" title={COPY[kind].title} description={COPY[kind].description} />
      <Panel title={`To do (${open.length})`} bodyClassName="">
        {queue.isLoading && <div className="p-5"><Spinner label="Loading your queue" /></div>}
        {queue.isError && <ErrorState error={queue.error} onRetry={() => queue.refetch()} />}
        {queue.isSuccess && open.length === 0 && <EmptyState icon="bi-check2-all" title="Nothing waiting">Approved appointments you are assigned to appear here.</EmptyState>}
        <ul className="divide-y divide-line">
          {open.map((r) => <Row key={r.appointmentPublicId} kind={kind} row={r} onChanged={refresh} />)}
        </ul>
      </Panel>
      {done.length > 0 && (
        <Panel title={`Done (${done.length})`} className="mt-5" bodyClassName="">
          <ul className="divide-y divide-line">
            {done.map((r) => <Row key={r.appointmentPublicId} kind={kind} row={r} onChanged={refresh} />)}
          </ul>
        </Panel>
      )}
    </>
  )
}
