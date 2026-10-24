import { App } from '@capacitor/app'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import { keepRefreshTokenWith, tokenStore } from '@/lib/api/http'

/*
  Staying signed in on the phone.

  The website keeps the sign-in for one browser tab. In the app that meant
  a patient was signed out whenever Android closed the app in the
  background, most often while they paid in the browser tab.

  The refresh token is kept in Android's encrypted storage (Keystore). It is
  only used again if the app was last active within the inactivity limit,
  the same limit that signs an idle patient out while the app is open. After
  that the patient signs in again, as on the website. The server keeps its
  own idle limit and refuses a stale token either way.
*/
const KEY = 'patient-session'
const IDLE_LIMIT_MS = Number(import.meta.env.VITE_FALLBACK_INACTIVITY_MINUTES || 30) * 60_000

type Kept = { refreshToken: string; lastActiveAt: number }

let current: string | null = null

async function write() {
  try {
    if (current) {
      const kept: Kept = { refreshToken: current, lastActiveAt: Date.now() }
      await SecureStorage.setItem(KEY, JSON.stringify(kept))
    } else {
      await SecureStorage.removeItem(KEY)
    }
  } catch {
    // Storage unavailable: the patient signs in again next time. Nothing else breaks.
  }
}

/** Before the first render. Picks up the last session if it is recent enough. */
export async function restoreSession() {
  try {
    const raw = await SecureStorage.getItem(KEY)
    const kept = raw ? (JSON.parse(raw) as Kept) : null
    if (kept?.refreshToken && Date.now() - kept.lastActiveAt < IDLE_LIMIT_MS) {
      current = kept.refreshToken
      tokenStore.adopt(kept.refreshToken)
    } else if (kept) {
      await SecureStorage.removeItem(KEY)
    }
  } catch {
    // Corrupt or unreadable: start signed out.
  }

  // Every sign-in, renewal and sign-out from here on.
  keepRefreshTokenWith((token) => {
    current = token
    void write()
  })
  // Leaving the app counts as the last activity.
  void App.addListener('pause', () => void write())
}
