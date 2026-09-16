import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { centresAdminApi, notificationsAdminApi, type TemplateRow } from '@/lib/api/endpoints/operations'
import { adminApi } from '@/lib/api/endpoints/admin'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatDateTime, humanise } from '@/lib/format'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Badge } from '@/components/ui/Badge'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { ReasonDialog } from '@/components/ui/ReasonDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

function Broadcast() {
  const qc = useQueryClient()
  const toast = useToast()
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => adminApi.roles.list() })
  const centres = useQuery({ queryKey: ['admin', 'centres'], queryFn: centresAdminApi.list })
  const history = useQuery({ queryKey: ['broadcasts'], queryFn: notificationsAdminApi.broadcasts })
  const [f, setF] = useState({ subject: '', body: '', targetRole: '', centrePublicId: '' })
  const [confirming, setConfirming] = useState(false)
  const everyone = !f.targetRole && !f.centrePublicId
  const audience = everyone
    ? 'every account in the system, staff and patients at every centre'
    : [f.targetRole ? `everyone with the ${humanise(f.targetRole)} role` : 'every role', f.centrePublicId ? `at ${centres.data?.find((c) => c.publicId === f.centrePublicId)?.name}` : 'everywhere'].join(' ')
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Panel title="Send a notice">
        <div className="space-y-4">
          <TextField label="Subject" maxLength={200} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
          <TextAreaField label="Message" rows={4} maxLength={2000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="To which role? (optional)" value={f.targetRole} onChange={(e) => setF({ ...f, targetRole: e.target.value })}>
              <option value="">All roles</option>
              {roles.data?.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
            </SelectField>
            <SelectField label="At which centre? (optional)" value={f.centrePublicId} onChange={(e) => setF({ ...f, centrePublicId: e.target.value })}>
              <option value="">Everywhere</option>
              {centres.data?.map((c) => <option key={c.publicId} value={c.publicId}>{c.name}</option>)}
            </SelectField>
          </div>
          {everyone ? (
            <Alert tone="danger" title="This goes to everyone">With neither filter set, the notice reaches every account in the system, including every patient.</Alert>
          ) : (
            <p className="text-sm text-muted">Goes to {audience}.</p>
          )}
          <button type="button" className="btn btn-primary" disabled={!f.subject.trim() || !f.body.trim()} onClick={() => setConfirming(true)}>Review and send</button>
        </div>
      </Panel>
      <Panel title="Sent notices" bodyClassName="">
        {history.isLoading && <div className="p-5"><Spinner /></div>}
        {history.isError && <ErrorState error={history.error} />}
        {history.data?.length === 0 && <p className="px-5 py-4 text-sm text-muted">None sent yet.</p>}
        <ul className="divide-y divide-line">
          {history.data?.map((b, i) => (
            <li key={i} className="px-5 py-3 text-sm">
              <p className="font-bold">{b.subject}</p>
              <p className="text-xs text-muted">{formatDateTime(b.sentAt)} by {b.sentBy}. {b.recipients} recipients. {b.target === 'EVERYONE' ? 'Everyone' : humanise(b.target)}{b.centre ? ` at ${b.centre}` : ''}</p>
            </li>
          ))}
        </ul>
      </Panel>
      {confirming && (
        <ReasonDialog
          title="Send this notice?"
          description={`It goes to ${audience}. A notice cannot be recalled.`}
          label="Why are you sending it?"
          confirmLabel="Send notice"
          danger={everyone}
          onClose={() => setConfirming(false)}
          onConfirm={async (reason) => {
            await notificationsAdminApi.broadcast({ subject: f.subject.trim(), body: f.body.trim(), targetRole: f.targetRole || undefined, centrePublicId: f.centrePublicId || undefined, reason })
            toast('Notice sent.')
            setConfirming(false)
            setF({ subject: '', body: '', targetRole: '', centrePublicId: '' })
            await qc.invalidateQueries({ queryKey: ['broadcasts'] })
          }}
        />
      )}
    </div>
  )
}

function Templates() {
  const qc = useQueryClient()
  const toast = useToast()
  const list = useQuery({ queryKey: ['templates'], queryFn: notificationsAdminApi.templates })
  const [editing, setEditing] = useState<TemplateRow | null>(null)
  const [draft, setDraft] = useState({ subject: '', body: '' })
  return (
    <Panel title="Message templates" bodyClassName="">
      {list.isLoading && <div className="p-5"><Spinner /></div>}
      {list.isError && <ErrorState error={list.error} />}
      <ul className="divide-y divide-line">
        {list.data?.map((t) => (
          <li key={t.publicId} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
            <span className="min-w-0">
              <span className="block font-bold">{humanise(t.notificationType)} <Badge>{humanise(t.channel)}</Badge></span>
              <span className="line-clamp-2 block text-muted">{t.subject ? `${t.subject}. ` : ''}{t.body}</span>
            </span>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setEditing(t); setDraft({ subject: t.subject ?? '', body: t.body }) }}>Edit</button>
          </li>
        ))}
      </ul>
      {editing && (
        <ReasonDialog
          title={`Edit ${humanise(editing.notificationType)} (${humanise(editing.channel)})`}
          description="Changes apply to every message of this type from now on."
          confirmLabel="Save template"
          onClose={() => setEditing(null)}
          onConfirm={async (reason) => {
            await notificationsAdminApi.saveTemplate(editing.notificationType, { channel: editing.channel, subject: draft.subject || undefined, body: draft.body, reason })
            toast('Template saved.')
            setEditing(null)
            await qc.invalidateQueries({ queryKey: ['templates'] })
          }}
        >
          {editing.channel === 'EMAIL' && <TextField wrapperClassName="mb-4" label="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />}
          <TextAreaField wrapperClassName="mb-4" label="Body" rows={6} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        </ReasonDialog>
      )}
    </Panel>
  )
}

export function Notifications() {
  const { can } = useAuth()
  return (
    <>
      <PageHeader kicker="Communication" title="Notices and templates" description="Broadcast a notice, and manage the wording of the messages the system sends." />
      {can('notification.send') && <Broadcast />}
      {can('notification.manage_templates') && <div className="mt-5"><Templates /></div>}
      {!can('notification.send') && !can('notification.manage_templates') && <Alert tone="info">Your account cannot send notices or edit templates.</Alert>}
    </>
  )
}
