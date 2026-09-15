import { parseServerTime } from '@/lib/format'
import { useNow } from '@/lib/hooks/useNow'

/**
  Counts to the scheduled end, not from when anyone joined: a late start does
  not buy extra time.
*/
export function SessionClock({ start, end, firstWarningMinutes, secondWarningMinutes }: { start: string; end: string; firstWarningMinutes: number; secondWarningMinutes: number }) {
  const now = useNow(1000)
  const startMs = parseServerTime(start)?.getTime() ?? now
  const endMs = parseServerTime(end)?.getTime() ?? now
  const before = now < startMs
  const left = endMs - now
  const abs = Math.abs(before ? startMs - now : left)
  const label = `${Math.floor(abs / 60000)}:${String(Math.floor((abs % 60000) / 1000)).padStart(2, '0')}`
  const minutes = left / 60000
  const tone = left < 0 || minutes <= secondWarningMinutes ? 'bg-alarm-700 text-white' : minutes <= firstWarningMinutes ? 'bg-amber-note text-gold-700' : 'bg-white text-ink'
  return (
    <div className={`flex items-center justify-between gap-3 rounded-[16px] px-4 py-3 shadow-[var(--shadow-card)] ${tone}`} role="timer" aria-live="polite">
      <span className="text-sm font-bold">
        {before ? 'Starts in' : left < 0 ? 'Over time by' : minutes <= secondWarningMinutes ? 'Wrap up now. Remaining' : minutes <= firstWarningMinutes ? 'Approaching the end. Remaining' : 'Remaining'}
      </span>
      <span className="font-display text-2xl font-extrabold tabular-nums">{label}</span>
    </div>
  )
}
