import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { centreApi } from '@/lib/api/endpoints/centre'
import type { CentreBundleRow, CentreCapability } from '@/lib/api/types'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime } from '@/lib/format'
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

export function Incoming({ title = 'Care bundles', description, capability = 'COORDINATION' }: { title?: string; description?: string; capability?: CentreCapability }) {
  const { can } = useAuth()
  const { pathname } = useLocation()
  const qc = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState<'incoming' | 'treated'>('incoming')
  const [treating, setTreating] = useState<CentreBundleRow | null>(null)
  const list = useQuery({
    queryKey: ['centre-bundles', capability, tab],
    queryFn: () => (tab === 'incoming' ? centreApi.incoming(capability) : centreApi.treated(capability)),
  })
  return (
    <>
      <PageHeader
        kicker="Centre"
        title={title}
        description={description ?? 'Prescriptions, investigation requests and follow-up plans released by FNPH after a consultation. Act on each, then mark it treated.'}
      />
      <div className="mb-4 flex gap-2">
        <button type="button" aria-pressed={tab === 'incoming'} className={`btn btn-sm ${tab === 'incoming' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('incoming')}>To act on</button>
        <button type="button" aria-pressed={tab === 'treated'} className={`btn btn-sm ${tab === 'treated' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('treated')}>Treated</button>
      </div>
      <Panel bodyClassName="">
        {list.isLoading && <div className="p-5"><Spinner /></div>}
        {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {list.data?.length === 0 && <EmptyState icon="bi-inbox" title={tab === 'incoming' ? 'Nothing to act on' : 'Nothing treated yet'} />}
        <ul className="divide-y divide-line">
          {list.data?.map((b) => (
            <li key={b.publicId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="font-bold">{b.patientName} <span className="font-normal text-muted">{b.centrePatientId}</span></p>
                <p className="text-xs text-muted">Consultation {b.appointmentReference}. Released {formatDateTime(b.deliveredAt)}.</p>
                {tab === 'treated' && b.treatedAt && (
                  <p className="mt-1 text-xs text-muted">
                    Treated {formatDateTime(b.treatedAt)}{b.treatedBy ? ` by ${b.treatedBy}` : ''}. {b.treatmentNotes}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {tab === 'incoming' && !b.firstOpenedAt && <Badge tone="navy">Not opened</Badge>}
                {tab === 'incoming' && b.outstanding && <Badge tone="gold">Outstanding</Badge>}
                {tab === 'treated' && <Badge tone="green">Treated</Badge>}
                <Link
                  to={`/centre/incoming/${encodeURIComponent(b.publicId)}`}
                  state={{ from: pathname, capability }}
                  className={`btn btn-sm no-underline ${tab === 'incoming' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {tab === 'incoming' ? 'Open' : 'View'}
                </Link>
                {tab === 'incoming' && can('centre_bundle.mark_treated') && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTreating(b)}>Mark treated</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
      {treating && (
        <ReasonDialog
          title={`Mark treated: ${treating.patientName}`}
          description="Record what the centre did with this bundle. It moves to the treated list."
          label="What was done"
          placeholder="Medication dispensed at the centre pharmacy. Follow-up booked for six weeks."
          confirmLabel="Mark treated"
          min={5}
          onClose={() => setTreating(null)}
          onConfirm={async (notes) => {
            await centreApi.markTreated(treating.publicId, notes, capability)
            toast('Marked treated.')
            setTreating(null)
            await Promise.all([
              qc.invalidateQueries({ queryKey: ['centre-bundles'] }),
              qc.invalidateQueries({ queryKey: ['centre-me'] }),
            ])
          }}
        />
      )}
    </>
  )
}
