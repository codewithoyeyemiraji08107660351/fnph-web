import { useState } from 'react'
import { consultationApi } from '@/lib/api/endpoints/clinical'
import { toApiError } from '@/lib/api/http'
import type { TerminationReason } from '@/lib/api/types'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextAreaField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

const TERMINATION_REASONS: Array<{ value: TerminationReason; label: string }> = [
  { value: 'FAILED_IDENTITY_VERIFICATION', label: 'Could not confirm the patient’s identity' },
  { value: 'UNACCEPTABLE_PRIVACY', label: 'Patient not in a private setting' },
  { value: 'PERSISTENT_DISRUPTION', label: 'Persistent disruption' },
  { value: 'ABUSE', label: 'Abusive behaviour' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'ACUTE_CLINICAL_UNSUITABILITY', label: 'Acutely unsuitable for remote care' },
  { value: 'UNSAFE_CONNECTIVITY', label: 'Connection too poor to continue safely' },
  { value: 'OTHER', label: 'Other' },
]

export function TerminateDialog({ consultationId, initialReason, onClose, onEnded }: { consultationId: string; initialReason?: TerminationReason; onClose: () => void; onEnded: (reason: TerminationReason) => void }) {
  const [reason, setReason] = useState<TerminationReason | ''>(initialReason ?? '')
  const [note, setNote] = useState('')
  const [safety, setSafety] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const safetyOk = safety.trim().length >= 10

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title="End the session early"
      description="The patient leaves the room. Record why, and what you did to keep them safe."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Go back</button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy || !reason || !safetyOk}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await consultationApi.terminate(consultationId, { reason: reason as TerminationReason, note: note.trim() || undefined, safetyAction: safety.trim() })
                onEnded(reason as TerminationReason)
              } catch (err) {
                setError(toApiError(err).message)
                setBusy(false)
              }
            }}
          >
            {busy ? <Spinner label="Ending" inverted /> : 'End the session'}
          </button>
        </>
      }
    >
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <SelectField label="Reason" value={reason} onChange={(e) => setReason(e.target.value as TerminationReason)}>
        <option value="">Choose a reason</option>
        {TERMINATION_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </SelectField>
      {reason === 'EMERGENCY' && <Alert tone="danger" className="mt-3">Follow the hospital’s emergency escalation now. Complete this record once the patient is safe.</Alert>}
      <TextAreaField wrapperClassName="mt-4" label="What happened (optional)" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      <TextAreaField
        wrapperClassName="mt-4"
        label="What did you do to keep the patient safe?"
        rows={3}
        maxLength={2000}
        value={safety}
        onChange={(e) => setSafety(e.target.value)}
        placeholder="Called the patient on the number on file, confirmed they were with family, and rebooked for Thursday."
        hint={safetyOk ? 'Required. Reviewed if this session is examined later.' : `Required. At least ${10 - safety.trim().length} more characters.`}
      />
    </Dialog>
  )
}
