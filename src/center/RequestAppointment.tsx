import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { centreApi } from './centreApi'

type Slot = { startAt: string; slotPublicId: string; remaining: number }

export default function RequestAppointment() {
  const { referralPublicId = '' } = useParams()
  const navigate = useNavigate()

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [times, setTimes] = useState<Slot[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // A date change invalidates the previous day's times and any error about
    // them. Leaving stale slots on screen while the new fetch is in flight
    // would let a user request a slot that no longer belongs to this date.
    let cancelled = false
    setTimes([])
    setError(null)
    setLoading(true)

    centreApi
      .bookingTimes(date)
      .then((slots) => {
        if (!cancelled) setTimes(slots)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load times for that day.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [date])

  if (!referralPublicId) {
    return (
      <p role="alert">
        This link is missing the referral. Open it from the patient list.
      </p>
    )
  }

  async function request(slotPublicId: string) {
    setBusy(slotPublicId)
    setError(null)
    try {
      await centreApi.requestAppointment(referralPublicId, slotPublicId)
      navigate('/centre/patients')
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'That request did not go through.',
      )
      setBusy(null)
    }
  }

  return (
    <div>
      <h1>Request an appointment</h1>

      {/*
        A request, not a hold. The FNPH pathway holds a slot while the patient
        pays; the centre pathway asks and FNPH decides. So there is no
        countdown here and no payment step, and the wording must not promise a
        booking.
      */}
      <p>
        FNPH decides whether to schedule this. You will see the referral move to
        scheduled once they approve it.
      </p>

      <label>
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
        />
      </label>

      {error && <p role="alert">{error}</p>}

      {loading ? (
        <p>Loading times...</p>
      ) : times.length === 0 ? (
        <p>No centre times available that day.</p>
      ) : (
        <ul>
          {times.map((t) => (
            <li key={t.slotPublicId}>
              {new Date(t.startAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' · '}
              {t.remaining} {t.remaining === 1 ? 'place' : 'places'} left
              <button
                onClick={() => request(t.slotPublicId)}
                disabled={busy !== null}
              >
                {busy === t.slotPublicId ? 'Requesting...' : 'Request this time'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}