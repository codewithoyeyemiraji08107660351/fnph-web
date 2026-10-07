import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { carePathApi } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import type { TriageResult } from '@/lib/api/types'
import { formatPhone } from '@/lib/format'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { ErrorState } from '@/components/ui/Page'
import { Spinner } from '@/components/ui/Spinner'
export function StopScreen({ result, onRetake }: {
  result: Pick<TriageResult, 'escalation' | 'stopReason'>
  /** Shown only when given. The emergency guidance always comes first. */
  onRetake?: () => void
}) {
  const { emergencyNumber } = usePublicSettings()
  // The call button leads. Nothing here goes to the calendar: a person who has
  // just said they are in crisis needs a number to call. Answering again is
  // offered below it, because this service is not built for emergencies and a
  // permanent lock would keep someone whose situation has changed from ever
  // getting care. Every answer is kept, and the Hub is told when a pass
  // follows a stop.
  return (
    <div className="rounded-[22px] border border-[#e9c3c0] bg-blush p-6 sm:p-8" role="alert">
      <span className="grid size-12 place-items-center rounded-2xl bg-alarm text-xl text-white">
        <i aria-hidden className="bi bi-telephone-fill" />
      </span>
      <h2 className="mt-4 text-2xl font-extrabold text-alarm-700">Please get help now</h2>
      <p className="mt-2 text-alarm-700">A video appointment is not the right care for what you have told us. Someone needs to see you today.</p>
      <a href={`tel:${emergencyNumber}`} className="btn btn-danger mt-5 w-full text-base no-underline sm:w-auto"
        // Inline because the patient stylesheet colours every link green, and
        // unlayered CSS beats Tailwind's utility layer: green on red was unreadable.
        style={{ color: '#fff' }}>
        Call {formatPhone(emergencyNumber)}
      </a>
      <p className="mt-3 text-sm text-alarm-700">Or go to the nearest hospital emergency department now.</p>
      {result.escalation && <p className="mt-5 text-sm whitespace-pre-line text-ink">{result.escalation}</p>}
      {onRetake && (
        <div className="mt-6 border-t border-[#e9c3c0] pt-5">
          <p className="text-sm font-bold text-ink">Has your situation changed?</p>
          <p className="mt-1 text-sm text-ink">
            Once you are safe and none of the safety questions apply to you any more, you can answer them again.
            Your earlier answers stay on your record and the care team can see them.
          </p>
          <button type="button" className="btn btn-secondary mt-3 w-full sm:w-auto" onClick={onRetake}>
            Answer the safety questions again
          </button>
        </div>
      )}
    </div>
  )
}

export function TriageStep({ onProceed, onStop, retake = false }: {
  onProceed: (r: TriageResult) => void
  onStop: (r: TriageResult) => void
  /** Answering again after a stop: different heading, same questions. */
  retake?: boolean
}) {
  const set = useQuery({ queryKey: ['triage-questions'], queryFn: carePathApi.questions })
  const [answers, setAnswers] = useState<Record<string, 'YES' | 'NO'>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const questions = useMemo(() => [...(set.data?.questions ?? [])].sort((a, b) => a.sequence - b.sequence), [set.data])
  if (set.isLoading) return <Spinner label="Loading the questions" />
  if (set.isError) return <ErrorState error={set.error} onRetry={() => set.refetch()} />
  const complete = questions.length > 0 && questions.every((q) => answers[q.publicId])
  return (
    <><div className="stage-header"><div><span>First-time setup</span><strong>Complete the safety questions</strong></div><span className="step-pill">Step 2 of 2</span></div><div className="screen-heading">{retake
        ? <><span className="eyebrow">Safety check again</span><h1>Check whether online care is suitable now</h1><p>Answer for how things are today. If any of these still apply, please get emergency help instead.</p></>
        : <><span className="eyebrow">One-time safety check</span><h1>Check whether online care is suitable</h1><p>Answer these questions once during your first sign-in. Your result will be reused when you request a consultation.</p></>}</div>
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


