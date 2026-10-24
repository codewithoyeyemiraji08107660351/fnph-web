import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { approvalsApi, releaseApi } from '@/lib/api/endpoints/hub'
import { toApiError } from '@/lib/api/http'

import { Alert } from '@/components/ui/Alert'
import { Dialog } from '@/components/ui/Dialog'
import { ReasonField, SelectField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

import { REASON_MIN } from './oversight'

export type CentreReviewType = 'PHARMACY' | 'LABORATORY'

const ROLE: Record<CentreReviewType, { code: string; label: string }> = {
  PHARMACY: { code: 'PHARMACIST', label: 'pharmacist' },
  LABORATORY: { code: 'LABORATORY_TECHNICIAN', label: 'laboratory technician' },
}

/**
 * Names the pharmacist or laboratory technician on a centre bundle.
 *
 * Centre approval can leave either empty, and the FNPH team tools cannot reach
 * a centre appointment, so this is the only way to put an unassigned centre
 * review in someone's queue. Every open review of that kind moves.
 */
export function CentreReviewerDialog({
  bundlePublicId,
  type,
  centreName,
  currentName,
  onClose,
}: {
  bundlePublicId: string
  type: CentreReviewType
  centreName?: string | null
  currentName?: string | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [chosen, setChosen] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const role = ROLE[type]

  const staff = useQuery({
    queryKey: ['assignable-staff', role.code],
    queryFn: () => approvalsApi.staff(role.code),
  })
  const options = (staff.data ?? []).filter((s) => s.roles.includes(role.code))
  const pick = options.find((o) => o.publicId === chosen)

  async function save() {
    if (!chosen) return
    setBusy(true)
    setError(null)
    try {
      const bundle = await releaseApi.assignCentreReviewer(bundlePublicId, {
        type,
        userPublicId: chosen,
        reason: reason.trim(),
      })
      qc.setQueryData(['bundle', bundlePublicId], bundle)
      await qc.invalidateQueries({ queryKey: ['release-desk'] })
      toast(`${pick?.fullName ?? 'The new reviewer'} now has this ${role.label} review.`)
      onClose()
    } catch (e) {
      setError(toApiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title={`${currentName ? 'Change' : 'Assign'} ${role.label}`}
      description={
        <>
          Centre consultation{centreName ? <> at <b>{centreName}</b></> : null}.{' '}
          {currentName ? <>Currently with <b>{currentName}</b>.</> : <>Nobody is assigned, so the review is in no queue.</>}
        </>
      }
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={busy || !chosen || reason.trim().length < REASON_MIN}
          >
            {busy ? 'Saving' : currentName ? 'Reassign' : 'Assign'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {staff.isLoading && <Spinner label={`Loading ${role.label}s`} />}
        {staff.isError && <Alert tone="danger">{toApiError(staff.error).message}</Alert>}
        {staff.isSuccess && (
          <>
            <SelectField
              label={role.label[0].toUpperCase() + role.label.slice(1)}
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
              hint="Active hospital staff holding this role. Every open review of this kind moves to them."
            >
              <option value="">Choose…</option>
              {options.map((o) => (
                <option key={o.publicId} value={o.publicId}>
                  {o.fullName}
                </option>
              ))}
            </SelectField>
            {options.length === 0 && (
              <Alert tone="warning">Nobody holds the {role.label} role. An administrator can grant it.</Alert>
            )}
            <ReasonField
              value={reason}
              onChange={setReason}
              min={REASON_MIN}
              hint="Kept in the audit log."
              placeholder={`No ${role.label} was named when this centre request was approved.`}
            />
          </>
        )}
      </div>
    </Dialog>
  )
}
