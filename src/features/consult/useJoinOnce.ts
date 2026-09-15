import { useEffect, useRef, useState } from 'react'
import { toApiError } from '@/lib/api/http'
import type { JoinResponse } from '@/lib/api/types'

export function useJoinOnce(key: string, join: () => Promise<JoinResponse>) {
  const started = useRef<string | null>(null)
  const [session, setSession] = useState<JoinResponse | null>(null)
  const [error, setError] = useState<{ message: string; status: number } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const token = `${key}:${attempt}`
    if (started.current === token) return
    started.current = token
    join()
      .then(setSession)
      .catch((err) => {
        const e = toApiError(err)
        setError({ message: e.message, status: e.status })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  return {
    session,
    error,
    /** Only for a deliberate user action, never automatic. */
    retry: () => {
      setError(null)
      setAttempt((a) => a + 1)
    },
  }
}
