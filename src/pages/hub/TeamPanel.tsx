import { useQuery } from '@tanstack/react-query'

import { oversightApi } from '@/lib/api/endpoints/hub'
import type { TeamChangeSource, TeamEventRow, TeamMember, TeamRole } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'

import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'

import { oversightKeys, ROLE_LABEL } from './oversight'

const ROLE_ICON: Record<TeamRole, string> = {
  DOCTOR: 'bi-heart-pulse',
  NURSE: 'bi-person-badge',
  PHARMACIST: 'bi-capsule',
  LABORATORY: 'bi-droplet',
  HIM: 'bi-folder2-open',
  ROOM: 'bi-door-open',
}

const SOURCE_LABEL: Record<TeamChangeSource, string> = {
  APPROVAL: 'At approval',
  ASSIGNMENT: 'Assigned',
  ROOM_CHANGE: 'Room moved',
  RESCHEDULE: 'Cleared by reschedule',
  BACKFILL: 'On record',
}

function SourceBadge({ source }: { source: TeamChangeSource }) {
  const tone = source === 'RESCHEDULE' ? 'gold' : source === 'ROOM_CHANGE' ? 'navy' : 'grey'
  return <Badge tone={tone}>{SOURCE_LABEL[source]}</Badge>
}

function CurrentTeam({ members }: { members: TeamMember[] }) {
  return (
    <dl className="grid gap-px overflow-hidden border-b border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
      {members.map((m) => (
        <div key={m.role} className="flex items-start gap-3 bg-white px-5 py-3">
          <i aria-hidden className={`bi ${ROLE_ICON[m.role]} mt-0.5 text-muted`} />
          <div className="min-w-0">
            <dt className="text-xs font-bold uppercase tracking-wide text-muted">{ROLE_LABEL[m.role]}</dt>
            <dd className={m.name ? 'truncate text-sm font-bold' : 'text-sm text-muted'}>
              {m.name ?? 'Not assigned'}
              {m.detail && <span className="block truncate text-xs font-normal text-muted">{m.detail}</span>}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  )
}

function change(e: TeamEventRow) {
  if (!e.fromLabel && e.toLabel) return <>assigned <b>{e.toLabel}</b></>
  if (e.fromLabel && !e.toLabel) return <>removed <b>{e.fromLabel}</b></>
  return <><span className="text-muted line-through">{e.fromLabel}</span> to <b>{e.toLabel}</b></>
}

function History({ events }: { events: TeamEventRow[] }) {
  if (events.length === 0) {
    return (
      <EmptyState icon="bi-people" title="No team changes recorded">
        Changes appear here from the moment a team is assigned.
      </EmptyState>
    )
  }
  return (
    <ol className="divide-y divide-line">
      {events.map((e, i) => (
        <li key={e.eventPublicId ?? `${e.role}-${e.changedAt}-${i}`} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
          <div className="min-w-0">
            <p>
              <span className="font-bold">{ROLE_LABEL[e.role]}</span>: {change(e)}
            </p>
            <p className="text-xs text-muted">
              {e.changedBy} · {formatDateTime(e.changedAt)}
              {e.reason && <> · {e.reason}</>}
            </p>
          </div>
          <SourceBadge source={e.source} />
        </li>
      ))}
    </ol>
  )
}

/** Who is on this consultation now, and every change that led there. */
export function TeamPanel({ appointmentPublicId, className = 'mt-5' }: { appointmentPublicId: string; className?: string }) {
  const team = useQuery({
    queryKey: oversightKeys.team(appointmentPublicId),
    queryFn: () => oversightApi.team(appointmentPublicId),
  })

  return (
    <Panel title="Care team" className={className} bodyClassName="">
      {team.isLoading && (
        <div className="p-5">
          <Spinner label="Loading team" />
        </div>
      )}
      {team.isError && <ErrorState error={team.error} onRetry={() => team.refetch()} />}
      {team.data && (
        <>
          <CurrentTeam members={team.data.current} />
          <h3 className="px-5 pb-1 pt-4 text-xs font-bold uppercase tracking-wide text-muted">Assignment history</h3>
          <History events={team.data.history} />
        </>
      )}
    </Panel>
  )
}
