import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { carePathApi } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import type { TriageResult } from '@/lib/api/types'
import { formatPhone } from '@/lib/format'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { ErrorState } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
export function StopScreen({ result }: { result: Pick<TriageResult, 'escalation' | 'stopReason'> }) {
  const { emergencyNumber } = usePublicSettings()
  // No booking link, no retry, nothing that leads to the calendar. A person who
  // has just said they are in crisis needs a number to call.
  return (
    <div className="rounded-[22px] border border-[#e9c3c0] bg-blush p-6 sm:p-8" role="alert">
      <span className="grid size-12 place-items-center rounded-2xl bg-alarm text-xl text-white">
        <i aria-hidden className="bi bi-telephone-fill" />
      </span>
      <h2 className="mt-4 text-2xl font-extrabold text-alarm-700">Please get help now</h2>
      <p className="mt-2 text-alarm-700">A video appointment is not the right care for what you have told us. Someone needs to see you today.</p>
      <a href={`tel:${emergencyNumber}`} className="btn btn-danger mt-5 w-full text-base no-underline sm:w-auto">
        Call {formatPhone(emergencyNumber)}
      </a>
      <p className="mt-3 text-sm text-alarm-700">Or go to the nearest hospital emergency department now.</p>
      {result.escalation && <p className="mt-5 text-sm whitespace-pre-line text-ink">{result.escalation}</p>}
    </div>
  )
}

export function TriageStep({ onProceed, onStop }: { onProceed: (r: TriageResult) => void; onStop: (r: TriageResult) => void }) {
  const set = useQuery({ queryKey: ['triage-questions'], queryFn: carePathApi.questions })
  const [answers, setAnswers] = useState<Record<string, 'YES' | 'NO'>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const questions = useMemo(() => [...(set.data?.questions ?? [])].sort((a, b) => a.sequence - b.sequence), [set.data])
  if (set.isLoading) return <Spinner label="Loading the questions" />
  if (set.isError) return <ErrorState error={set.error} onRetry={() => set.refetch()} />
  const complete = questions.length > 0 && questions.every((q) => answers[q.publicId])
  return (
    <><div className="stage-header"><div><span>First-time setup</span><strong>Complete the safety questions</strong></div><span className="step-pill">Step 2 of 2</span></div><div className="screen-heading"><span className="eyebrow">One-time safety check</span><h1>Check whether online care is suitable</h1><p>Answer these questions once during your first sign-in. Your result will be reused when you request a consultation.</p></div>
      <div className="notice danger"><b>Do not use this portal for a psychiatric or medical emergency.</b><span>If you are in immediate danger or cannot participate safely, seek urgent physical help instead of waiting for a video appointment.</span></div>
      <form className="card triage-card" onSubmit={(event) => { event.preventDefault(); void (async () => {
        setBusy(true); setError(null)
        try { const result = await carePathApi.submitTriage(answers); if (result.mayProceed) onProceed(result); else onStop(result) }
        catch (err) { setError(toApiError(err).message) } finally { setBusy(false) }
      })() }}>
        {questions.map((q, i) => <fieldset key={q.publicId}><legend>{i + 1}. {q.questionText}</legend>{(['YES', 'NO'] as const).map((v) => <label key={v}><input type="radio" name={q.publicId} checked={answers[q.publicId] === v} onChange={() => setAnswers((a) => ({ ...a, [q.publicId]: v }))} /> {v === 'YES' ? 'Yes' : 'No'}</label>)}</fieldset>)}
      {error && <div className="triage-result" role="alert">{error}</div>}
      <div className="actions">
      <button
        type="submit"
        className="button primary"
        disabled={!complete || busy}
      >
        {busy ? <Spinner label="Checking" inverted /> : 'Continue'}
      </button>
      </div></form></>
  )
}


