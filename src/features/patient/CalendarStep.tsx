import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { bookingApi, intakeApi, type IntakeDraft } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import { formatTime } from '@/lib/format'
import type { Appointment, AvailableTime } from '@/lib/api/types'
import { ErrorState } from '@/components/ui/Page'

const dateParts = (value: string) => {
  const date = new Date(`${value}T12:00:00Z`)
  return {
    weekday: date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
    day: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
    long: date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  }
}

export function CalendarStep({ draft, onBooked }: { draft: IntakeDraft; onBooked: (appointment: Appointment) => void }) {
  const days = useQuery({ queryKey: ['published-days'], queryFn: bookingApi.days })
  const [date, setDate] = useState('')
  const [selected, setSelected] = useState<AvailableTime | null>(null)
  const [mode, setMode] = useState(draft.intake.mode)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const times = useQuery({ queryKey: ['booking-times', date], queryFn: () => bookingApi.times(date), enabled: Boolean(date) })
  const published = days.data?.slice(0, 6) ?? []
  const chosenDate = date ? dateParts(date) : null

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await intakeApi.save({ ...draft.intake, mode })
      onBooked(await bookingApi.request(draft.publicId, selected!.slotPublicId))
    } catch (err) {
      setError(toApiError(err).message)
      void times.refetch()
      void days.refetch()
    } finally {
      setBusy(false)
    }
  }

  return <>
    <div className="screen-heading booking-screen-heading"><span className="eyebrow">Booking request</span><h1>Select an approved date and time</h1><p>Only consultation dates published by FNPH Kaduna are active. Your clinical team and room will be assigned after review.</p></div>
    {days.isError && <ErrorState error={days.error} onRetry={() => days.refetch()} />}
    <div className="booking-layout reference-booking-layout">
      <section className="card calendar-card reference-calendar-card">
        <div className="booking-section-title"><span>01</span><h2>Choose an approved date</h2><small>West Africa Time (WAT)</small></div>
        {days.isLoading && <p>Loading published dates…</p>}
        {days.data?.length === 0 && <p>No dates are available yet. Your verified payment remains on your account. Please contact support.</p>}
        <div className="approved-date-grid">{published.map(day => { const part = dateParts(day); return <button key={day} type="button" aria-pressed={date === day} onClick={() => { setDate(day); setSelected(null); setError('') }}><small>{part.weekday}</small><b>{part.day}</b><span>Published</span></button> })}</div>
        {chosenDate && <div className="selected-date-note">{chosenDate.long} · 30-minute intervals · Only available times can be selected.</div>}
        <div className="booking-section-title time-title"><span>02</span><h2>Choose an available time</h2><small><i className="available-dot" /> Available</small></div>
        {times.isError && <ErrorState error={times.error} onRetry={() => times.refetch()} />}
        <div className="slot-grid" role="radiogroup" aria-label="Available appointment times">{times.data?.map(time => <button type="button" aria-checked={selected?.slotPublicId === time.slotPublicId} key={time.slotPublicId} onClick={() => setSelected(time)}><b>{formatTime(time.startAt)}</b><small>to {formatTime(time.endAt)}</small></button>)}{!date && <p>Choose one of the approved dates above to see available times.</p>}{date && times.data?.length === 0 && <p>These times have filled. Choose another approved date.</p>}</div>
      </section>
      <aside className="card booking-summary reference-booking-summary">
        <span className="eyebrow">Your selection</span>
        <div className="selection-date"><span>{chosenDate?.day.split(' ')[0] ?? '—'}</span><div><b>{selected ? `${formatTime(selected.startAt)} – ${formatTime(selected.endAt)}` : 'Select a time'}</b><small>Available slots appear in 30-minute intervals.</small></div></div>
        <div className="assignment-note"><b>No doctor selection</b><span>FNPH Kaduna will assign the appropriate doctor and room after the request is reviewed.</span></div>
        <fieldset className="mode-field"><legend>Preferred consultation mode</legend><label><input type="radio" name="consult-mode" checked={mode === 'VIDEO'} onChange={() => setMode('VIDEO')} /><span><b>Video</b><small>Recommended</small></span></label><label><input type="radio" name="consult-mode" checked={mode === 'AUDIO_FALLBACK'} onChange={() => setMode('AUDIO_FALLBACK')} /><span><b>Audio</b><small>Fallback</small></span></label></fieldset>
        <label className="check-line"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /><span>I accept the fixed 30-minute appointment and understand that the Hub Coordinator must approve this request.</span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary full submit-button" disabled={!selected || !accepted || busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit for Hub approval'}</button>
        <p className="summary-note">Select an available time and accept the booking rules.</p>
      </aside>
    </div>
  </>
}
