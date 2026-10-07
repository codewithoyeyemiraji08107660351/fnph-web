import { Link } from 'react-router-dom'

import { Dialog } from '@/components/ui/Dialog'

import { TeamPanel } from '../TeamPanel'
import { WorkflowTimelinePanel } from '../WorkflowTimelinePanel'

export interface ConsultationRef {
  appointmentPublicId: string
  reference?: string | null
  patientName?: string | null
  bundlePublicId?: string | null
  status?: string | null
}

/** One consultation's team and full history, opened from anywhere on the dashboard. */
export function ConsultationDialog({ consultation, onClose }: { consultation: ConsultationRef; onClose: () => void }) {
  const { appointmentPublicId, reference, patientName, bundlePublicId, status } = consultation

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={patientName ?? 'Consultation'}
      description={reference ? `Reference ${reference}` : undefined}
      footer={
        <>
          {status === 'AWAITING_APPROVAL' && (
            <Link to={`/hub/approvals/${encodeURIComponent(appointmentPublicId)}`} className="btn btn-secondary no-underline">
              Open approval
            </Link>
          )}
          {bundlePublicId && (
            <Link to={`/hub/releases/${encodeURIComponent(bundlePublicId)}`} className="btn btn-secondary no-underline">
              Open clinical bundle
            </Link>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <TeamPanel appointmentPublicId={appointmentPublicId} className="" />
      <WorkflowTimelinePanel appointmentPublicId={appointmentPublicId} />
    </Dialog>
  )
}