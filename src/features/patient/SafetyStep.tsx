import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { carePathApi } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import type { TriageResult } from '@/lib/api/types'
import { formatPhone } from '@/lib/format'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { ErrorState, Panel } from '@/components/ui/Page'
import { Alert } from '@/components/ui/Alert'
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

export function TriageStep({ onProceed, onStop }: { onProceed: () => void; onStop: (r: TriageResult) => void }) {
  const set = useQuery({ queryKey: ['triage-questions'], queryFn: carePathApi.questions })
  const [answers, setAnswers] = useState<Record<string, 'YES' | 'NO'>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const questions = useMemo(() => [...(set.data?.questions ?? [])].sort((a, b) => a.sequence - b.sequence), [set.data])
  if (set.isLoading) return <Spinner label="Loading the questions" />
  if (set.isError) return <ErrorState error={set.error} onRetry={() => set.refetch()} />
  const complete = questions.length > 0 && questions.every((q) => answers[q.publicId])
  return (
    <Panel title="A few questions before you book">
      <p className="text-sm text-muted">These check that a video consultation is safe for you right now. Answer honestly. There is no wrong answer.</p>
      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
      <ol className="mt-5 space-y-4">
        {questions.map((q, i) => (
          <li key={q.publicId}>
            <fieldset className="rounded-[14px] border border-line p-4">
              <legend className="px-1 text-sm font-bold">
                {i + 1}. {q.questionText}
              </legend>
              <div className="mt-2 flex gap-3">
                {(['YES', 'NO'] as const).map((v) => (
                  <label key={v} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] border text-sm font-bold ${answers[q.publicId] === v ? 'border-accent bg-accent-soft text-accent' : 'border-line'}`}>
                    <input type="radio" className="sr-only" name={q.publicId} checked={answers[q.publicId] === v} onChange={() => setAnswers((a) => ({ ...a, [q.publicId]: v }))} />
                    {v === 'YES' ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="btn btn-primary mt-5"
        disabled={!complete || busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            const result = await carePathApi.submitTriage(answers)
            if (result.mayProceed) onProceed()
            else onStop(result)
          } catch (err) {
            setError(toApiError(err).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? <Spinner label="Checking" inverted /> : 'Continue'}
      </button>
    </Panel>
  )
}


