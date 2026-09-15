import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { recordApi } from '@/lib/api/endpoints/clinical'
import { formatDateTime, humanise } from '@/lib/format'
import { ClinicalPanel } from '@/features/consult/ClinicalPanel'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'

export function ConsultationRecordPage() {
  const { consultationId = '' } = useParams()
  const summary = useQuery({ queryKey: ['consultation', consultationId], queryFn: () => recordApi.summary(consultationId) })
  if (summary.isLoading) return <Spinner label="Loading the consultation" />
  if (summary.isError || !summary.data) return <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
  const c = summary.data
  const facts: Array<[string, string | undefined]> = [
    ['Scheduled', `${formatDateTime(c.scheduledStartAt)} to ${formatDateTime(c.scheduledEndAt)}`],
    ['Doctor joined', c.doctorJoinedAt ? formatDateTime(c.doctorJoinedAt) : 'Did not join'],
    ['Patient joined', c.patientJoinedAt ? formatDateTime(c.patientJoinedAt) : 'Did not join'],
    ['Modality', c.modality ? humanise(c.modality) : undefined],
    ['Identity', c.identityConfirmed ? 'Confirmed' : 'Not confirmed'],
    ['Outcome', c.outcome ? humanise(c.outcome) : c.endedAt ? 'Ended' : 'Open'],
    ['Ended early', c.terminationReason ? humanise(c.terminationReason) : undefined],
    ['Safety action', c.safetyActionTaken],
  ]
  return (
    <>
      <Link to="/clinical" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold no-underline"><i aria-hidden className="bi bi-arrow-left" /> My consultations</Link>
      <PageHeader kicker="Consultation record" title="Complete the record" description="Sign the note and settle each component. The bundle releases to the patient once everything is issued or recorded as not needed." />
      <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
        <Panel title="Session">
          <dl className="space-y-2.5 text-sm">
            {facts.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <ClinicalPanel consultationId={consultationId} />
      </div>
    </>
  )
}
