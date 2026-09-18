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
  return <><div className="screen-heading"><span className="eyebrow">Payment verified · booking</span><h1>Choose a published date and time</h1><p>All times are West Africa Time (WAT). The Hub Coordinator reviews your request before confirming the doctor and room.</p></div>
    {days.isError && <ErrorState error={days.error} onRetry={() => days.refetch()} />}
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><section className="card"><div className="flex items-center justify-between"><button className="button secondary" disabled={month === 0} onClick={() => setMonth(m => m-1)} aria-label="Previous month">←</button><h2>{first.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})}</h2><button className="button secondary" disabled={month === 2} onClick={() => setMonth(m => m+1)} aria-label="Next month">→</button></div>
      <div className="patient-calendar">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <b key={d}>{d}</b>)}{Array.from({length:first.getUTCDay()},(_,i) => <span key={`empty-${i}`} />)}{Array.from({length},(_,i) => { const day=`${prefix}-${String(i+1).padStart(2,'0')}`; return <button key={day} type="button" disabled={!days.data?.includes(day)} aria-pressed={date === day} onClick={() => { setDate(day);setSelected(null);setError('') }}>{i+1}</button> })}</div>
      <p className="text-sm text-muted">Only administrator-published days with available appointments can be selected.</p>{days.isLoading && <p>Loading published dates…</p>}{days.data?.length === 0 && <p>No dates are available yet. Your verified payment remains on your account. Please contact support.</p>}
      {date && <h3 className="mt-5">Available 30-minute appointments · {date}</h3>}{times.isError && <ErrorState error={times.error} onRetry={() => times.refetch()} />}<div className="mt-3 grid grid-cols-2 gap-2">{times.data?.map(t => <button className={`button ${selected?.slotPublicId===t.slotPublicId?'primary':'secondary'}`} key={t.slotPublicId} onClick={() => setSelected(t)}>{formatTime(t.startAt)} – {formatTime(t.endAt)}</button>)}</div>{date && times.data?.length===0 && <p>These times have filled. Choose another published day.</p>}
    </section><aside className="card journey-form"><span className="eyebrow">Your request</span><h2>{date || 'Choose a date'}</h2><p>{selected ? `${formatTime(selected.startAt)} – ${formatTime(selected.endAt)} WAT` : 'Choose an available time'}</p><fieldset><legend>Consultation mode</legend><label><input type="radio" checked={mode==='VIDEO'} onChange={() => setMode('VIDEO')} /> Video — recommended</label><label><input type="radio" checked={mode==='AUDIO_FALLBACK'} onChange={() => setMode('AUDIO_FALLBACK')} /> Audio fallback where needed</label></fieldset><label className="check-line"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>I understand the 30-minute slot is fixed, joining late will not extend it, and the Hub Coordinator must approve my request.</span></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={!selected || !accepted || busy} onClick={async () => { setBusy(true);setError('');try { await intakeApi.save({...draft.intake,mode});onBooked(await bookingApi.request(draft.publicId,selected!.slotPublicId)) } catch(err) {setError(toApiError(err).message);void times.refetch();void days.refetch()}finally{setBusy(false)} }}>{busy?'Submitting…':'Submit booking request →'}</button></aside></div>
  </>
}
