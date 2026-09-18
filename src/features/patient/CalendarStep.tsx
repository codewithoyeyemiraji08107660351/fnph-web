import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { bookingApi, intakeApi, type IntakeDraft } from '@/lib/api/endpoints/patient'
import { toApiError } from '@/lib/api/http'
import { formatTime } from '@/lib/format'
import type { Appointment, AvailableTime } from '@/lib/api/types'
import { ErrorState } from '@/components/ui/Page'

export function CalendarStep({ draft, onBooked }: { draft: IntakeDraft; onBooked: (appointment: Appointment) => void }) {
  const days = useQuery({ queryKey: ['published-days'], queryFn: bookingApi.days })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date())
  const [month, setMonth] = useState(0)
  const [date, setDate] = useState('')
  const [selected, setSelected] = useState<AvailableTime | null>(null)
  const [mode, setMode] = useState(draft.intake.mode)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const times = useQuery({ queryKey: ['booking-times', date], queryFn: () => bookingApi.times(date), enabled: !!date })
  const base = new Date(`${today}T12:00:00Z`)
  const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth()+month,1,12))
  const length = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate()
  const prefix = first.toISOString().slice(0,7)
  return <><div className="screen-heading"><span className="eyebrow">Payment verified · 30-minute sessions</span><h1>Choose a published date and time</h1><p>Only dates and timeframes published by Central Administration are selectable. Your doctor and room are assigned later by the Hub Coordinator.</p></div>
    {days.isError && <ErrorState error={days.error} onRetry={() => days.refetch()} />}
    <div className="booking-layout"><section className="card calendar-card"><div className="calendar-toolbar"><button type="button" disabled={month === 0} onClick={() => setMonth(m => m-1)} aria-label="Previous month">‹</button><label>Select a month<select value={month} onChange={e => { setMonth(Number(e.target.value)); setDate(''); setSelected(null) }}>{[0,1,2].map(offset => { const d=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+offset,1)); return <option key={offset} value={offset}>{d.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})}</option> })}</select></label><button type="button" disabled={month === 2} onClick={() => setMonth(m => m+1)} aria-label="Next month">›</button></div>
      <div className="calendar-head"><b>{first.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})}</b><span>{days.data?.filter(day => day.startsWith(prefix)).length ?? 0} published days</span></div><div className="calendar-weekdays" aria-hidden>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <span key={d}>{d}</span>)}</div><div className="calendar-grid">{Array.from({length:first.getUTCDay()},(_,i) => <span key={`empty-${i}`} />)}{Array.from({length},(_,i) => { const day=`${prefix}-${String(i+1).padStart(2,'0')}`; const available=!!days.data?.includes(day); return <button key={day} type="button" disabled={!available} aria-pressed={date === day} onClick={() => { setDate(day);setSelected(null);setError('') }}><span>{i+1}</span><small>{available?'Published':'Not available'}</small></button> })}</div>
      <div className="calendar-legend"><span><i className="approved" /> Published</span><span><i className="selected" /> Selected</span><span><i /> Not available</span></div><div className="section-divider"><span>{date ? `Available appointments · ${date}` : 'Select a published day'}</span><small>West Africa Time (WAT)</small></div>
      {days.isLoading && <p>Loading published dates…</p>}{days.data?.length === 0 && <p>No dates are available yet. Your verified payment remains on your account. Please contact support.</p>}{times.isError && <ErrorState error={times.error} onRetry={() => times.refetch()} />}<div className="slot-grid" role="radiogroup" aria-label="Available appointment times">{times.data?.map(t => <button type="button" aria-checked={selected?.slotPublicId===t.slotPublicId} key={t.slotPublicId} onClick={() => setSelected(t)}><b>{formatTime(t.startAt)}</b><small>to {formatTime(t.endAt)}</small></button>)}{date && times.data?.length===0 && <p>These times have filled. Choose another published day.</p>}</div>
    </section><aside className="card booking-summary"><span className="eyebrow">Your booking</span><h2>Appointment request</h2><div className="summary-lines"><div><span>Date</span><b>{date || 'Choose a date'}</b></div><div><span>Time</span><b>{selected ? `${formatTime(selected.startAt)} – ${formatTime(selected.endAt)}` : 'Choose a time'}</b></div><div><span>Duration</span><b>30 minutes</b></div><div><span>Doctor and room</span><b>Assigned after review</b></div></div><fieldset className="mode-field"><legend>Preferred consultation mode</legend><label><input type="radio" name="consult-mode" checked={mode==='VIDEO'} onChange={() => setMode('VIDEO')} /><span><b>Video</b><small>Recommended</small></span></label><label><input type="radio" name="consult-mode" checked={mode==='AUDIO_FALLBACK'} onChange={() => setMode('AUDIO_FALLBACK')} /><span><b>Audio</b><small>Fallback where needed</small></span></label></fieldset><label className="check-line"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>I understand the 30-minute slot is fixed, joining late will not extend it, and the Hub Coordinator must approve my request.</span></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full submit-button" disabled={!selected || !accepted || busy} onClick={async () => { setBusy(true);setError('');try { await intakeApi.save({...draft.intake,mode});onBooked(await bookingApi.request(draft.publicId,selected!.slotPublicId)) } catch(err) {setError(toApiError(err).message);void times.refetch();void days.refetch()}finally{setBusy(false)} }}>{busy?'Submitting…':'Submit booking request →'}</button><p className="summary-note">Select an available time and accept the booking rules.</p></aside></div>
  </>
}
