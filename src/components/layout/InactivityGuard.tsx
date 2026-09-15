import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { usePublicSettings } from '@/lib/hooks/usePublicSettings'
import { authApi } from '@/lib/api/endpoints/auth'
import { Dialog } from '@/components/ui/Dialog'

const WARNING_SECONDS = 120
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/**
  Signs the person out after the configured idle period, matching the server's
  inactivity timeout, with a two-minute warning. An unattended clinical
  workstation must not stay signed in.
*/
export function InactivityGuard() {
  const { signOut } = useAuth()
  const { inactivityMinutes } = usePublicSettings()
  const lastActivity = useRef(0)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    lastActivity.current = Date.now()
    let throttled = 0
    const mark = () => {
      const now = Date.now()
      if (now - throttled < 5000) return
      throttled = now
      lastActivity.current = now
    }
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true }))
    return () => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, mark))
  }, [])

  useEffect(() => {
    const limitMs = inactivityMinutes * 60_000
    const tick = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current
      const remaining = Math.ceil((limitMs - idle) / 1000)
      if (remaining <= 0) {
        window.clearInterval(tick)
        void signOut('You were signed out after a period of inactivity.')
      } else if (remaining <= WARNING_SECONDS) {
        setSecondsLeft(remaining)
      } else {
        setSecondsLeft(null)
      }
    }, 1000)
    return () => window.clearInterval(tick)
  }, [inactivityMinutes, signOut])

  const stay = async () => {
    lastActivity.current = Date.now()
    setSecondsLeft(null)
    // Tells the server the session is in use so its idle timer resets too.
    await authApi.me().catch(() => undefined)
  }

  const minutes = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0
  const seconds = secondsLeft !== null ? String(secondsLeft % 60).padStart(2, '0') : '00'

  return (
    <Dialog
      open={secondsLeft !== null}
      onClose={stay}
      title="Are you still there?"
      description="For patient privacy, idle sessions end automatically."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={() => signOut()}>
            Sign out now
          </button>
          <button type="button" className="btn btn-primary" onClick={stay}>
            Stay signed in
          </button>
        </>
      }
    >
      <p className="text-sm text-muted">You will be signed out in</p>
      <p className="font-display text-4xl font-extrabold tabular-nums" aria-live="polite">
        {minutes}:{seconds}
      </p>
    </Dialog>
  )
}
