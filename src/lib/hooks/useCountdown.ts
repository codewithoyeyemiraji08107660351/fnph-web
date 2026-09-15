import { parseServerTime } from '@/lib/format'
import { useNow } from './useNow'

/** Time left until a server timestamp, ticking every second. */
export function useCountdown(until?: string | null) {
  const now = useNow(1000)
  const target = parseServerTime(until)?.getTime()
  const ms = target === undefined ? 0 : Math.max(0, target - now)
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return { ms, expired: target !== undefined && ms === 0, label: `${minutes}:${String(seconds).padStart(2, '0')}` }
}
