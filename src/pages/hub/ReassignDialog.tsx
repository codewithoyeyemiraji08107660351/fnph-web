import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { approvalsApi, oversightApi } from '@/lib/api/endpoints/hub'
import { toApiError } from '@/lib/api/http'
import type { ReassignableRole } from '@/lib/api/types'
import { formatDateTime, formatTime, parseServerTime, watDate } from '@/lib/format'

import { Alert } from '@/components/ui/Alert'
import { Dialog } from '@/components/ui/Dialog'
import { ReasonField, SelectField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

import { oversightKeys, REASON_MIN, ROLE_CODE, ROLE_LABEL, useRefreshAfterTeamChange } from './oversight'

interface Option {
  publicId: string
  label: string
  current: boolean
}

/**
 * Assign or replace one person on a consultation's team after approval.
 *
 * Doctors are offered only when their rota covers the whole slot, as on the
 * approval screen; the server also refuses one who has another consultation
 * then. For the pharmacist and laboratory technician, open reviews move with
 * the role. Picking the person already in the role is allowed only to pick up
 * reviews that were created with nobody assigned.
 */
export function ReassignDialog({
  appointmentPublicId,
  role,
  onClose,
}: {
  appointmentPublicId: string
  role: ReassignableRole
  onClose: () => void
}) {
  const toast = useToast()
  const refresh = useRefreshAfterTeamChange()
  const [chosen, setChosen] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const team = useQuery({
    queryKey: oversightKeys.team(appointmentPublicId),
    queryFn: () => oversightApi.team(appointmentPublicId),
  })

  const isDoctor = role === 'DOCTOR'
  const serviceDate = watDate(team.data?.appointmentDate)

  const staff = useQuery({
    queryKey: ['assignable-staff', ROLE_CODE[role]],
    queryFn: () => approvalsApi.staff(ROLE_CODE[role]),
    enabled: !isDoctor,
  })
  const availability = useQuery({
    queryKey: ['availability', serviceDate],
    queryFn: () => approvalsApi.availability(serviceDate),
    enabled: isDoctor && !!serviceDate,
  })

  const holder = team.data?.current.find((m) => m.role === role)
  const openReviews = role === 'PHARMACIST' || role === 'LABORATORY' ? (team.data?.openReviews[role] ?? 0) : 0
  const lockedReason = team.data?.locked[role]

  const options: Option[] = useMemo(() => {
    if (isDoctor) {
      const start = parseServerTime(team.data?.appointmentDate)?.getTime() ?? 0
      const end = parseServerTime(team.data?.scheduledEndAt)?.getTime() ?? start
      const seen = new Set<string>()
      return (availability.data ?? [])
        .filter(
          (a) =>
            a.available &&
            (parseServerTime(a.startAt)?.getTime() ?? Infinity) <= start &&
            (parseServerTime(a.endAt)?.getTime() ?? 0) >= end,
        )
        .filter((a) => (seen.has(a.doctorPublicId) ? false : (seen.add(a.doctorPublicId), true)))
        .filter((a) => a.doctorPublicId !== holder?.publicId)
        .map((a) => ({
          publicId: a.doctorPublicId,
          label: `${a.doctor} (on rota ${formatTime(a.startAt)} to ${formatTime(a.endAt)})`,
          current: false,
        }))
    }
    return (staff.data ?? [])
      .filter((s) => s.roles.includes(ROLE_CODE[role]))
      // The current holder only helps when there are reviews to pick up.
      .filter((s) => s.publicId !== holder?.publicId || openReviews > 0)
      .map((s) => ({
        publicId: s.publicId,
        label: s.publicId === holder?.publicId ? `${s.fullName} (already assigned)` : s.fullName,
        current: s.publicId === holder?.publicId,
      }))
  }, [isDoctor, availability.data, staff.data, team.data, holder?.publicId, role, openReviews])

  const pick = options.find((o) => o.publicId === chosen)
  const loading = team.isLoading || (isDoctor ? availability.isLoading : staff.isLoading)
  const loadError = team.error ?? (isDoctor ? availability.error : staff.error)
  const reasonShort = reason.trim().length < REASON_MIN
  const roleName = ROLE_LABEL[role].toLowerCase()

  async function save() {
    if (!chosen) return
    setBusy(true)
    setError(null)
    try {
      const result = await oversightApi.reassign(appointmentPublicId, role, {
        userPublicId: chosen,
        reason: reason.trim(),
      })
      await refresh(appointmentPublicId)
      const now = result.current.find((m) => m.role === role)?.name
      toast(
        pick?.current
          ? `Open reviews are now with ${now ?? 'the assigned reviewer'}.`
          : `${now ?? 'The new person'} is now the ${roleName}. Both people have been told.`,
      )
      onClose()
    } catch (e) {
      const apiError = toApiError(e)
      setError(apiError.message)
      // 409: the role locked or the doctor is busy. Pull the latest state.
      if (apiError.status === 409) await refresh(appointmentPublicId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title={`${holder?.name ? 'Change' : 'Assign'} ${roleName}`}
      description={
        team.data ? (
          <>
            {team.data.appointmentReference}
            {team.data.appointmentDate && <>, {formatDateTime(team.data.appointmentDate)}</>}.{' '}
            {holder?.name ? <>Currently <b>{holder.name}</b>.</> : <>Nobody holds this role.</>}
          </>
        ) : undefined
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
            disabled={busy || !chosen || reasonShort || !!lockedReason}
          >
            {busy ? 'Saving' : pick?.current ? 'Move reviews' : holder?.name ? 'Reassign' : 'Assign'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {loading && <Spinner label="Loading who can take this role" />}
        {loadError && <Alert tone="danger">{toApiError(loadError).message}</Alert>}

        {lockedReason && <Alert tone="warning">{lockedReason}</Alert>}

        {!loading && !loadError && !lockedReason && (
          <>
            <SelectField
              label={ROLE_LABEL[role]}
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
              hint={
                isDoctor
                  ? 'Only doctors whose rota covers the whole slot are listed. A doctor with another consultation at that time is refused.'
                  : 'Active hospital staff holding this role.'
              }
            >
              <option value="">Choose…</option>
              {options.map((o) => (
                <option key={o.publicId} value={o.publicId}>
                  {o.label}
                </option>
              ))}
            </SelectField>

            {options.length === 0 && (
              <Alert tone="warning">
                {isDoctor
                  ? `No other doctor on the ${serviceDate} rota covers this whole slot.`
                  : `Nobody else holds the ${roleName} role. An administrator can grant it.`}
              </Alert>
            )}

            {openReviews > 0 && (
              <Alert tone="info">
                {openReviews} unsubmitted review{openReviews === 1 ? '' : 's'} will move to{' '}
                {pick ? <b>{pick.label.replace(' (already assigned)', '')}</b> : 'the person you choose'}.
                Submitted reviews stay with whoever submitted them.
              </Alert>
            )}

            <ReasonField
              value={reason}
              onChange={setReason}
              min={REASON_MIN}
              hint="Kept in the team history and the audit log."
              placeholder={
                isDoctor
                  ? 'Dr Bello is in theatre all afternoon; Dr Musa has covered the clinic.'
                  : 'On leave until Monday; review needs doing before the patient travels.'
              }
            />
          </>
        )}
      </div>
    </Dialog>
  )
}
