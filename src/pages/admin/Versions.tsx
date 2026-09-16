import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { versionsApi, type Audience, type ConsentVersion, type TriageQuestionDraft, type TriageSetVersion } from '@/lib/api/endpoints/records'
import { toApiError } from '@/lib/api/http'
import { formatDateTime } from '@/lib/format'
import { ErrorState, PageHeader, Panel } from '@/components/ui/Page'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

const AUDIENCE_LABEL: Record<Audience, string> = { FNPH_PATIENT: 'FNPH patients', CENTRE: 'Centres of Excellence' }

function StatusBadge({ status, placeholder }: { status: string; placeholder: boolean }) {
  if (status === 'PUBLISHED') return <Badge tone="green">In use</Badge>
  if (status === 'RETIRED') return <Badge>Retired</Badge>
  return placeholder ? <Badge tone="red">Draft, placeholder text</Badge> : <Badge tone="gold">Draft</Badge>
}

function PublishDialog({ label, audience, onConfirm, onClose }: { label: string; audience: Audience; onConfirm: () => Promise<unknown>; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog open onClose={onClose} busy={busy} title={`Put ${label} into use?`}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
          setBusy(true); setError(null)
          try { await onConfirm() } catch (err) { setError(toApiError(err).message); setBusy(false) }
        }}>{busy ? <Spinner label="Publishing" inverted /> : 'Put into use'}</button></>}>
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <p className="text-sm">From now on, {AUDIENCE_LABEL[audience].toLowerCase()} see this version. The version in use now is retired. Past agreements and answers stay linked to the exact text people saw.</p>
      <p className="mt-3 text-sm text-muted">Published wording cannot be edited. A change means a new version.</p>
    </Dialog>
  )
}

function ConsentSection({ audience }: { audience: Audience }) {
  const qc = useQueryClient()
  const toast = useToast()
  const list = useQuery({ queryKey: ['consent-versions', audience], queryFn: () => versionsApi.consent(audience) })
  const [editing, setEditing] = useState<ConsentVersion | 'new' | null>(null)
  const [publishing, setPublishing] = useState<ConsentVersion | null>(null)
  const [draft, setDraft] = useState({ version: '', title: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['consent-versions', audience] })
  const open = (v: ConsentVersion | 'new') => {
    setError(null)
    setEditing(v)
    setDraft(v === 'new' ? { version: '', title: 'Consent to telepsychiatry', body: '' } : { version: v.version, title: v.title, body: v.body })
  }
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      if (editing === 'new') await versionsApi.createConsent({ audience, version: draft.version.trim(), title: draft.title.trim(), body: draft.body.trim() })
      else if (editing) await versionsApi.editConsent(editing.publicId, { title: draft.title.trim(), body: draft.body.trim() })
      toast('Draft saved. It is not in use until you publish it.')
      setEditing(null)
      await refresh()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setBusy(false)
    }
  }
  const inUse = list.data?.find((v) => v.status === 'PUBLISHED')
  return (
    <Panel title="Consent text" action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => open('new')}>New version</button>} bodyClassName="">
      {!list.isLoading && !inUse && (
        <Alert tone="danger" className="m-4">No consent text is in use. {audience === 'CENTRE' ? 'No centre can submit a referral' : 'No patient can book'} until one is published.</Alert>
      )}
      {list.isLoading && <div className="p-5"><Spinner /></div>}
      {list.isError && <ErrorState error={list.error} />}
      <ul className="divide-y divide-line">
        {list.data?.map((v) => (
          <li key={v.publicId} className="px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="block font-bold">{v.title} <span className="font-normal text-muted">version {v.version}</span></span>
                <span className="block text-xs text-muted">
                  {v.status === 'PUBLISHED' ? `In use since ${formatDateTime(v.effectiveFrom)} (${v.publishedBy})` : v.status === 'RETIRED' ? `Retired ${formatDateTime(v.retiredAt)}` : `Written ${formatDateTime(v.createdAt)}`}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge status={v.status} placeholder={v.placeholder} />
                {v.status === 'DRAFT' && <button type="button" className="btn btn-quiet btn-sm" onClick={() => open(v)}>Edit</button>}
                {v.status === 'DRAFT' && <button type="button" className="btn btn-primary btn-sm" disabled={v.placeholder} title={v.placeholder ? 'Replace the placeholder wording first' : undefined} onClick={() => setPublishing(v)}>Publish</button>}
              </span>
            </div>
            <details className="mt-1 text-sm"><summary className="cursor-pointer text-muted">Read the text</summary><p className="mt-2 rounded-[12px] bg-canvas p-3 whitespace-pre-line">{v.body}</p></details>
          </li>
        ))}
      </ul>
      {editing && (
        <Dialog open size="lg" onClose={() => setEditing(null)} busy={busy} title={editing === 'new' ? 'New consent version' : `Edit draft ${editing.version}`}
          description="Write the wording FNPH has approved. Text containing PLACEHOLDER cannot be published."
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy || !draft.title.trim() || !draft.body.trim() || (editing === 'new' && !draft.version.trim())} onClick={save}>{busy ? <Spinner label="Saving" inverted /> : 'Save draft'}</button></>}>
          {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <TextField label="Version" maxLength={30} placeholder="2026.1" value={draft.version} disabled={editing !== 'new'} onChange={(e) => setDraft({ ...draft, version: e.target.value })} />
            <TextField label="Title" maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <TextAreaField wrapperClassName="mt-4" label="Text people agree to" rows={14} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        </Dialog>
      )}
      {publishing && (
        <PublishDialog label={`consent version ${publishing.version}`} audience={audience} onClose={() => setPublishing(null)}
          onConfirm={async () => { await versionsApi.publishConsent(publishing.publicId); toast('Consent text is in use.'); setPublishing(null); await refresh() }} />
      )}
    </Panel>
  )
}

const EMPTY_Q: TriageQuestionDraft = { questionText: '', stopAnswer: 'YES', stopReason: '' }

function TriageSection({ audience }: { audience: Audience }) {
  const qc = useQueryClient()
  const toast = useToast()
  const list = useQuery({ queryKey: ['triage-versions', audience], queryFn: () => versionsApi.triage(audience) })
  const [writing, setWriting] = useState(false)
  const [publishing, setPublishing] = useState<TriageSetVersion | null>(null)
  const [version, setVersion] = useState('')
  const [questions, setQuestions] = useState<TriageQuestionDraft[]>([{ ...EMPTY_Q }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['triage-versions', audience] })
  const setQ = (i: number, patch: Partial<TriageQuestionDraft>) => setQuestions(questions.map((q, n) => (n === i ? { ...q, ...patch } : q)))
  const valid = version.trim() && questions.every((q) => q.questionText.trim() && q.stopReason.trim())
  const inUse = list.data?.find((v) => v.status === 'PUBLISHED')
  return (
    <Panel title="Safety questions" action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => { setWriting(true); setError(null) }}>New version</button>} bodyClassName="">
      {!list.isLoading && !inUse && audience === 'FNPH_PATIENT' && <Alert tone="danger" className="m-4">No safety questions are in use. No patient can book until a set is published.</Alert>}
      {list.isLoading && <div className="p-5"><Spinner /></div>}
      {list.isError && <ErrorState error={list.error} />}
      <ul className="divide-y divide-line">
        {list.data?.map((v) => (
          <li key={v.publicId} className="px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">Version {v.version} <span className="font-normal text-muted">{v.questions.length} question{v.questions.length === 1 ? '' : 's'}</span></span>
              <span className="flex items-center gap-2">
                <StatusBadge status={v.status} placeholder={v.placeholder} />
                {v.status === 'DRAFT' && <button type="button" className="btn btn-primary btn-sm" disabled={v.placeholder} onClick={() => setPublishing(v)}>Publish</button>}
              </span>
            </div>
            <ol className="mt-2 space-y-1 text-sm">
              {v.questions.map((q) => (
                <li key={q.sequence}>
                  {q.sequence}. {q.questionText} <span className="text-xs text-alarm-700">Stops on {q.stopAnswer === 'YES' ? 'Yes' : 'No'}: {q.stopReason}</span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
      {writing && (
        <Dialog open size="lg" onClose={() => setWriting(false)} busy={busy} title="New set of safety questions"
          description="Each question has one answer that stops the booking and shows the emergency route. The wording decides who is turned away, so it must be FNPH's own."
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setWriting(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy || !valid} onClick={async () => {
              setBusy(true); setError(null)
              try {
                await versionsApi.createTriage({ audience, version: version.trim(), questions: questions.map((q) => ({ questionText: q.questionText.trim(), stopAnswer: q.stopAnswer, stopReason: q.stopReason.trim() })) })
                toast('Draft saved. It is not in use until you publish it.'); setWriting(false); setVersion(''); setQuestions([{ ...EMPTY_Q }]); await refresh()
              } catch (err) { setError(toApiError(err).message) } finally { setBusy(false) }
            }}>{busy ? <Spinner label="Saving" inverted /> : 'Save draft'}</button></>}>
          {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
          <TextField label="Version" maxLength={30} placeholder="T-2026.1" value={version} onChange={(e) => setVersion(e.target.value)} />
          <ol className="mt-4 space-y-3">
            {questions.map((q, i) => (
              <li key={i} className="rounded-[14px] border border-line p-3">
                <div className="flex items-center justify-between"><span className="text-xs font-bold text-muted">Question {i + 1}</span>
                  {questions.length > 1 && <button type="button" className="text-alarm" aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions(questions.filter((_, n) => n !== i))}><i aria-hidden className="bi bi-x-circle" /></button>}
                </div>
                <TextAreaField label="Question" rows={2} maxLength={1000} value={q.questionText} onChange={(e) => setQ(i, { questionText: e.target.value })} />
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr]">
                  <SelectField label="Stops the booking on" value={q.stopAnswer} onChange={(e) => setQ(i, { stopAnswer: e.target.value as 'YES' | 'NO' })}>
                    <option value="YES">Yes</option>
                    <option value="NO">No</option>
                  </SelectField>
                  <TextField label="Recorded reason when it stops" maxLength={200} placeholder="Current risk of harm" value={q.stopReason} onChange={(e) => setQ(i, { stopReason: e.target.value })} />
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-secondary btn-sm mt-3" disabled={questions.length >= 20} onClick={() => setQuestions([...questions, { ...EMPTY_Q }])}><i aria-hidden className="bi bi-plus" /> Add a question</button>
        </Dialog>
      )}
      {publishing && (
        <PublishDialog label={`safety questions version ${publishing.version}`} audience={audience} onClose={() => setPublishing(null)}
          onConfirm={async () => { await versionsApi.publishTriage(publishing.publicId); toast('Safety questions are in use.'); setPublishing(null); await refresh() }} />
      )}
    </Panel>
  )
}

export function Versions() {
  const [audience, setAudience] = useState<Audience>('FNPH_PATIENT')
  return (
    <>
      <PageHeader kicker="Clinical governance" title="Consent and safety questions" description="The wording people agree to and the questions that decide whether a video consultation is safe. Draft, check, then publish." />
      <div className="mb-4 flex gap-2">
        {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => (
          <button key={a} type="button" aria-pressed={audience === a} className={`btn btn-sm ${audience === a ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAudience(a)}>{AUDIENCE_LABEL[a]}</button>
        ))}
      </div>
      <div className="space-y-5">
        <ConsentSection key={`c-${audience}`} audience={audience} />
        <TriageSection key={`t-${audience}`} audience={audience} />
      </div>
    </>
  )
}
