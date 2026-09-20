import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/api/endpoints/admin'
import { toApiError } from '@/lib/api/http'
import type { CreateStaffUserRequest } from '@/lib/api/types'
import { Dialog } from '@/components/ui/Dialog'
import { ReasonField, SelectField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const EMPTY: CreateStaffUserRequest = { username: '', email: '', firstName: '', lastName: '', phoneNumber: '', staffNumber: '', primaryRoleCode: '', centrePublicId: '', reason: '' }

export function InviteUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<CreateStaffUserRequest>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => adminApi.roles.list(), enabled: open })
  const selectedRole = roles.data?.find((r) => r.code === form.primaryRoleCode)
  const needsCentre = selectedRole?.scope === 'CENTRE'
  const centres = useQuery({ queryKey: ['admin', 'centres'], queryFn: adminApi.centres.list, enabled: open && needsCentre })

  // Patients enrol themselves with an EHR number. They are never invited.
  const invitable = useMemo(() => (roles.data ?? []).filter((r) => r.scope !== 'PATIENT' && r.active), [roles.data])

  const close = () => {
    setForm(EMPTY)
    setErrors({})
    setFormError(null)
    onClose()
  }

  const invite = useMutation({
    mutationFn: () =>
      adminApi.users.invite({
        ...form,
        username: form.username.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber?.trim() || undefined,
        staffNumber: form.staffNumber?.trim() || undefined,
        centrePublicId: needsCentre ? form.centrePublicId : undefined,
        reason: form.reason.trim(),
      }),
    onSuccess: (user) => {
      toast(`Invitation sent to ${user.email}. It expires in 72 hours.`)
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      close()
    },
    onError: (err) => {
      const e = toApiError(err)
      setErrors(e.validationErrors)
      setFormError(e.message)
    },
  })

  const set = (k: keyof CreateStaffUserRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (!/^[a-zA-Z0-9._-]{3,100}$/.test(form.username.trim())) local.username = 'Use 3 or more letters, numbers, dots, underscores or hyphens.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) local.email = 'Enter a valid email address.'
    if (!form.firstName.trim()) local.firstName = 'Required.'
    if (!form.lastName.trim()) local.lastName = 'Required.'
    if (!form.primaryRoleCode) local.primaryRoleCode = 'Choose a role.'
    if (needsCentre && !form.centrePublicId) local.centrePublicId = 'Choose the centre this account belongs to.'
    if (form.reason.trim().length < 10) local.reason = 'Give a reason of at least 10 characters.'
    setErrors(local)
    setFormError(null)
    if (Object.keys(local).length === 0) invite.mutate()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      busy={invite.isPending}
      title="Invite a user"
      description="The person receives a single-use link to choose their own password. No password is ever generated or emailed."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close} disabled={invite.isPending}>Cancel</button>
          <button type="submit" form="invite-form" className="btn btn-primary" disabled={invite.isPending}>
            {invite.isPending ? <Spinner label="Sending" inverted /> : 'Send invitation'}
          </button>
        </>
      }
    >
      <form id="invite-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {formError && <Alert tone="danger" className="sm:col-span-2">{formError}</Alert>}
        <TextField label="First name" value={form.firstName} onChange={set('firstName')} error={errors.firstName} maxLength={50} required />
        <TextField label="Last name" value={form.lastName} onChange={set('lastName')} error={errors.lastName} maxLength={50} required />
        <TextField label="Username" value={form.username} onChange={set('username')} error={errors.username} maxLength={100} autoCapitalize="none" spellCheck={false} hint="For example a.ibrahim" required />
        <TextField label="Work email" type="email" value={form.email} onChange={set('email')} error={errors.email} maxLength={100} required />
        <TextField label="Phone number" type="tel" value={form.phoneNumber} onChange={set('phoneNumber')} error={errors.phoneNumber} maxLength={20} hint="Optional" />
        <TextField label="Staff number" value={form.staffNumber} onChange={set('staffNumber')} error={errors.staffNumber} maxLength={50} hint="Optional" />
        <SelectField label="Role" value={form.primaryRoleCode} onChange={set('primaryRoleCode')} error={errors.primaryRoleCode} required hint={selectedRole?.description}>
          <option value="">{roles.isLoading ? 'Loading roles' : 'Choose a role'}</option>
          {(['FNPH', 'CENTRE'] as const).map((scope) => (
            <optgroup key={scope} label={scope === 'FNPH' ? 'FNPH Kaduna' : 'Centre of Excellence'}>
              {invitable.filter((r) => r.scope === scope).map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </optgroup>
          ))}
        </SelectField>
        {needsCentre ? (
          <SelectField label="Centre" value={form.centrePublicId} onChange={set('centrePublicId')} error={errors.centrePublicId} required>
            <option value="">{centres.isLoading ? 'Loading centres' : 'Choose a centre'}</option>
            {centres.data?.map((c) => (
              <option key={c.publicId} value={c.publicId}>
                {c.name} {c.status !== 'ACTIVE' ? `(${c.status.toLowerCase()})` : ''}
              </option>
            ))}
          </SelectField>
        ) : (
          <div className="hidden sm:block" />
        )}
        <div className="sm:col-span-2">
          <ReasonField value={form.reason} onChange={(v) => setForm((f) => ({ ...f, reason: v }))} min={10} error={errors.reason} label="Reason for creating this account" />
        </div>
      </form>
    </Dialog>
  )
}
