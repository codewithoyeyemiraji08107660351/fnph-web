import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { staffWorkApi, type WorkSubject } from '@/lib/api/endpoints/staffWork'
import type {
  AppointmentStatus,
  WorkConsultationItem,
  WorkRecordItem,
  WorkReviewItem,
  WorkRole,
  WorkVerificationItem,
} from '@/lib/api/types'
import { formatDateTime, formatRelative, humanise } from '@/lib/format'

import { AppointmentBadge, WorkStateBadge } from '@/components/ui/AppointmentBadge'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState, Pager, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
import { formatHours } from '@/pages/hub/dashboard/dashboard'

import { WORK_HOME } from './workFormat'

const PAGE_SIZE = 20

export interface OpenConsultation {
  appointmentPublicId: string
  reference?: string | null
  patientName?: string | null
}

function Patient({ name, ehr, reference }: { name?: string | null; ehr?: string | null; reference?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-bold">{name ?? 'Patient'}</p>
      <p className="text-xs text-muted">
        {ehr ? `EHR ${ehr}` : null}
        {ehr && reference ? ' · ' : null}
        {reference}
      </p>
    </div>
  )
}

function OpenButton({ onClick, label = 'Details' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn btn-quiet btn-sm" onClick={onClick}>
      {label}
    </button>
  )
}

function ConsultationRow({ row, mine, onOpen }: { row: WorkConsultationItem; mine: boolean; onOpen?: (c: OpenConsultation) => void }) {
  const ended = !!row.endedAt
  return (
    <li className="grid gap-3 px-5 py-4 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.4fr)_8rem] sm:items-start">
      <div className="text-sm">
        <p className="font-semibold tabular-nums">{formatDateTime(row.appointmentDate)}</p>
        <div className="mt-1"><AppointmentBadge status={row.status as AppointmentStatus} /></div>
      </div>
      <Patient name={row.patientName} ehr={row.ehrNumber} reference={row.reference} />
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {row.startedAt ? (
          <span className="text-muted">
            Session {row.minutes != null ? `${row.minutes} min` : 'running'}
            {row.outcome && row.outcome !== 'COMPLETED' ? `, ${humanise(row.outcome).toLowerCase()}` : ''}
          </span>
        ) : (
          <span className="text-muted">No session</span>
        )}
        {row.noteSigned
          ? <Badge tone="green">Note signed</Badge>
          : ended ? <Badge tone="red">Note not signed</Badge> : null}
        {row.prescriptions > 0 && <Badge tone="grey">{row.prescriptions} prescription{row.prescriptions === 1 ? '' : 's'}</Badge>}
        {row.investigations > 0 && <Badge tone="grey">{row.investigations} investigation{row.investigations === 1 ? '' : 's'}</Badge>}
        {row.followUp && <Badge tone="navy">Follow-up</Badge>}
        {row.bundleStatus === 'RELEASED' && <Badge tone="green">Released</Badge>}
      </div>
      <div className="flex gap-1 sm:justify-end">
        {mine && row.consultationPublicId && (
          <Link to={`/clinical/consultations/${encodeURIComponent(row.consultationPublicId)}`} className="btn btn-quiet btn-sm no-underline">
            Open record
          </Link>
        )}
        {mine && !row.consultationPublicId && row.status === 'APPROVED' && (
          <Link to={`/clinical/appointments/${encodeURIComponent(row.appointmentPublicId)}`} className="btn btn-quiet btn-sm no-underline">
            Open
          </Link>
        )}
        {onOpen && <OpenButton onClick={() => onOpen(row)} />}
      </div>
    </li>
  )
}

const REVIEW_STATE: Record<WorkReviewItem['state'], { tone: 'green' | 'navy' | 'gold' | 'red' | 'grey'; label: string }> = {
  NOT_OPENED: { tone: 'gold', label: 'Not opened' },
  IN_PROGRESS: { tone: 'navy', label: 'In review' },
  SUBMITTED: { tone: 'green', label: 'Verified' },
  QUERY_RAISED: { tone: 'red', label: 'Query raised' },
  WITHDRAWN: { tone: 'grey', label: 'Document replaced' },
}

function ReviewRow({ row, mine, onOpen }: { row: WorkReviewItem; mine: boolean; onOpen?: (c: OpenConsultation) => void }) {
  const state = REVIEW_STATE[row.state]
  const waiting = row.state === 'NOT_OPENED' || row.state === 'IN_PROGRESS'
  return (
    <li className="grid gap-3 px-5 py-4 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.4fr)_8rem] sm:items-start">
      <div className="text-sm">
        <Badge tone={state.tone}>{state.label}</Badge>
        <p className="mt-1 text-xs text-muted">{row.reviewType === 'PHARMACY' ? 'Prescription' : 'Investigation'} {row.documentNumber ?? ''}</p>
      </div>
      <Patient name={row.patientName} ehr={row.ehrNumber} reference={row.reference} />
      <div className="text-sm text-muted">
        <p>Assigned {formatDateTime(row.assignedAt)}</p>
        {row.submittedAt
          ? <p>Submitted {formatDateTime(row.submittedAt)}{row.turnaroundHours != null && <span className="font-semibold text-ink"> · {formatHours(row.turnaroundHours)}</span>}</p>
          : waiting && <p className="font-semibold text-gold-700">Waiting {formatRelative(row.assignedAt).replace(/ ago$/, '')}</p>}
      </div>
      <div className="flex gap-1 sm:justify-end">
        {mine && waiting && (
          <Link to={WORK_HOME[row.reviewType === 'PHARMACY' ? 'PHARMACIST' : 'LABORATORY']} className="btn btn-secondary btn-sm no-underline">
            Open queue
          </Link>
        )}
        {onOpen && row.appointmentPublicId && (
          <OpenButton onClick={() => onOpen({ appointmentPublicId: row.appointmentPublicId!, reference: row.reference, patientName: row.patientName })} />
        )}
      </div>
    </li>
  )
}

function RecordRow({ row, mine, onOpen }: { row: WorkRecordItem; mine: boolean; onOpen?: (c: OpenConsultation) => void }) {
  const late = row.hoursBeforeSession != null && row.hoursBeforeSession < 0
  const nursing = row.kind === 'PREPARATION'
  return (
    <li className="grid gap-3 px-5 py-4 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.4fr)_8rem] sm:items-start">
      <div className="text-sm">
        <p className="font-semibold tabular-nums">{formatDateTime(row.appointmentDate)}</p>
        <div className="mt-1"><WorkStateBadge state={row.state} /></div>
      </div>
      <Patient name={row.patientName} ehr={row.ehrNumber} reference={row.reference} />
      <div className="text-sm text-muted">
        {row.completedAt ? (
          <p>
            Ready {formatDateTime(row.completedAt)}
            {row.hoursBeforeSession != null && (
              <span className={`font-semibold ${late ? 'text-alarm' : 'text-ink'}`}>
                {' · '}{late ? `${formatHours(-row.hoursBeforeSession)} after the start` : `${formatHours(row.hoursBeforeSession)} before`}
              </span>
            )}
          </p>
        ) : row.startedAt ? <p>Started {formatDateTime(row.startedAt)}</p> : <p>Not started</p>}
        {nursing && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            {(row.readings ?? 0) > 0
              ? <Badge tone="green">{row.readings} reading{row.readings === 1 ? '' : 's'}</Badge>
              : row.state !== 'TREATED' && <Badge tone="red">No readings yet</Badge>}
            {row.room && <span>{row.room}</span>}
          </p>
        )}
        {row.exceptionReason && <p className="mt-1 text-alarm-700">Issue: {row.exceptionReason}</p>}
      </div>
      <div className="flex gap-1 sm:justify-end">
        {mine && row.state !== 'TREATED' && row.status === 'APPROVED' && (
          <Link to={WORK_HOME[nursing ? 'NURSE' : 'HIM']} className="btn btn-secondary btn-sm no-underline">Open queue</Link>
        )}
        {onOpen && <OpenButton onClick={() => onOpen(row)} />}
      </div>
    </li>
  )
}

function VerificationRow({ row }: { row: WorkVerificationItem }) {
  return (
    <li className="grid gap-3 px-5 py-4 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.3fr)] sm:items-start">
      <div className="text-sm">
        {row.status === 'RESOLVED' ? <Badge tone="green">Matched</Badge> : <Badge tone="red">Rejected</Badge>}
      </div>
      <Patient name={row.fullName} ehr={row.ehrNumberClaimed} />
      <div className="text-sm text-muted">
        <p>Decided {formatDateTime(row.resolvedAt)}</p>
        {row.hoursToResolve != null && <p>{formatHours(row.hoursToResolve)} after the request</p>}
      </div>
    </li>
  )
}

/**
 * Everything behind the numbers, newest first, a page at a time. For the
 * Hub Coordinator, each consultation opens its full workflow and team.
 */
export function WorkHistory({
  who,
  role,
  from,
  to,
  onOpen,
}: {
  who: WorkSubject
  role: WorkRole
  from: string
  to: string
  onOpen?: (c: OpenConsultation) => void
}) {
  const mine = who.kind === 'me'
  const [kind, setKind] = useState<'RECORDS' | 'VERIFICATIONS'>('RECORDS')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)

  const items = useQuery({
    queryKey: ['work-items', who, role, from, to, role === 'HIM' ? kind : null, q, page],
    queryFn: () => staffWorkApi.items(who, { role, from, to, kind: role === 'HIM' ? kind : undefined, q, page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const title = role === 'DOCTOR' ? 'Consultations' : role === 'NURSE' ? 'Patients prepared' : role === 'HIM' ? 'History' : 'Reviews'
  const total = items.data?.total ?? 0

  return (
    <Panel title={title} bodyClassName="" action={items.data ? <span className="text-sm text-muted">{total}</span> : undefined}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        {role === 'HIM' && (
          <div className="flex gap-1.5" role="group" aria-label="Show">
            {(['RECORDS', 'VERIFICATIONS'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => { setKind(k); setPage(0) }}
                className={`btn btn-sm ${kind === k ? 'btn-secondary' : 'btn-quiet'}`}
              >
                {k === 'RECORDS' ? 'Record retrievals' : 'Enrolment checks'}
              </button>
            ))}
          </div>
        )}
        <form
          className="ml-auto flex w-full gap-2 sm:w-auto"
          role="search"
          onSubmit={(e) => { e.preventDefault(); setQ(search); setPage(0) }}
        >
          <input
            className="input min-w-0 flex-1 sm:w-64"
            type="search"
            aria-label="Search by patient, EHR number or reference"
            placeholder="Patient, EHR or reference"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary btn-sm">Search</button>
        </form>
      </div>

      {items.isLoading && <div className="p-5"><Spinner label="Loading history" /></div>}
      {items.isError && <ErrorState error={items.error} onRetry={() => items.refetch()} />}
      {items.isSuccess && total === 0 && (
        <EmptyState icon="bi-clock-history" title={q ? 'Nothing matches that search' : 'Nothing in this period'}>
          {q ? 'Try a different name, EHR number or reference.' : 'Choose a longer period to see earlier work.'}
        </EmptyState>
      )}

      {items.data && items.data.items.length > 0 && (
        <>
          <ul className={`divide-y divide-line ${items.isFetching ? 'opacity-60' : ''}`}>
            {items.data.items.map((row) => {
              switch (row.kind) {
                case 'CONSULTATION':
                  return <ConsultationRow key={row.appointmentPublicId} row={row} mine={mine} onOpen={onOpen} />
                case 'REVIEW':
                  return <ReviewRow key={row.reviewPublicId} row={row} mine={mine} onOpen={onOpen} />
                case 'RECORD':
                case 'PREPARATION':
                  return <RecordRow key={row.appointmentPublicId} row={row} mine={mine} onOpen={onOpen} />
                case 'VERIFICATION':
                  return <VerificationRow key={row.requestPublicId} row={row} />
              }
            })}
          </ul>
          {total > PAGE_SIZE && (
            <Pager
              page={page}
              hasNext={(page + 1) * PAGE_SIZE < total}
              onChange={setPage}
              summary={`${page * PAGE_SIZE + 1} to ${Math.min(total, (page + 1) * PAGE_SIZE)} of ${total}`}
            />
          )}
        </>
      )}
    </Panel>
  )
}
