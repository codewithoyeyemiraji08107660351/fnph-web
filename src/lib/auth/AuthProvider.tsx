import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/lib/api/endpoints/auth'
import { adminApi } from '@/lib/api/endpoints/admin'
import {
  SESSION_EXPIRED,
  getSupervisionSessionId,
  refreshSession,
  sessionEvents,
  setSupervisionSession,
  tokenStore,
  toApiError,
} from '@/lib/api/http'
import type { LoginResponse, Principal, ViewAsSession } from '@/lib/api/types'
import { parseServerTime } from '@/lib/format'

type Status = 'loading' | 'anonymous' | 'authenticated'

const SUPERVISION_DETAIL_KEY = 'fnph.session.viewAsDetail'

interface AuthContextValue {
  status: Status
  principal: Principal | null
  /** Why the last session ended, shown once on the sign-in page. */
  endedReason: string | null
  clearEndedReason: () => void
  can: (permission: string) => boolean
  /** The signed-in account's own permissions, ignoring any supervised session. For the account's own navigation. */
  canOwn: (permission: string) => boolean
  hasRole: (...codes: string[]) => boolean
  /** Stores tokens from a completed sign-in step and loads the principal. */
  completeSignIn: (response: LoginResponse) => Promise<Principal>
  signOut: (reason?: string) => Promise<void>
  reloadPrincipal: () => Promise<void>
  supervision: ViewAsSession | null
  startSupervision: (targetUserPublicId: string, reason: string) => Promise<ViewAsSession>
  endSupervision: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredSupervision(): ViewAsSession | null {
  if (!getSupervisionSessionId()) return null
  try {
    const raw = sessionStorage.getItem(SUPERVISION_DETAIL_KEY)
    return raw ? (JSON.parse(raw) as ViewAsSession) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>(() => (tokenStore.hasRefreshToken() ? 'loading' : 'anonymous'))
  const [principal, setPrincipal] = useState<Principal | null>(null)
  const [endedReason, setEndedReason] = useState<string | null>(null)
  const [supervision, setSupervision] = useState<ViewAsSession | null>(readStoredSupervision)
  const bootstrapped = useRef(false)

  const resetLocal = useCallback(
    (reason: string | null) => {
      tokenStore.clear()
      sessionStorage.removeItem(SUPERVISION_DETAIL_KEY)
      setSupervision(null)
      setPrincipal(null)
      setStatus('anonymous')
      setEndedReason(reason)
      queryClient.clear()
    },
    [queryClient],
  )

  const loadPrincipal = useCallback(async () => {
    const me = await authApi.me()
    setPrincipal(me)
    setStatus('authenticated')
    return me
  }, [])

  // Restore a session after a reload.
  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true
    if (!tokenStore.hasRefreshToken()) return
    refreshSession()
      .then(loadPrincipal)
      .catch((err) => {
        const e = toApiError(err)
        resetLocal(e.isNetworkError ? 'The service could not be reached, so you were signed out. Sign in again when your connection returns.' : null)
      })
  }, [loadPrincipal, resetLocal])

  useEffect(() => {
    const onExpired = () => resetLocal('Your session ended. Sign in again to continue.')
    sessionEvents.addEventListener(SESSION_EXPIRED, onExpired)
    return () => sessionEvents.removeEventListener(SESSION_EXPIRED, onExpired)
  }, [resetLocal])

  // A supervised session has a hard expiry on the server. Mirror it here.
  useEffect(() => {
    if (!supervision) return
    const ms = (parseServerTime(supervision.expiresAt)?.getTime() ?? 0) - Date.now()
    const clear = () => {
      setSupervisionSession(null)
      sessionStorage.removeItem(SUPERVISION_DETAIL_KEY)
      setSupervision(null)
    }
    if (Number.isNaN(ms) || ms <= 0) {
      clear()
      return
    }
    const timer = window.setTimeout(clear, Math.min(ms, 2 ** 31 - 1))
    return () => window.clearTimeout(timer)
  }, [supervision])

  const completeSignIn = useCallback(
    async (response: LoginResponse) => {
      tokenStore.setFromLogin(response)
      setEndedReason(null)
      return loadPrincipal()
    },
    [loadPrincipal],
  )

  const signOut = useCallback(
    async (reason?: string) => {
      const refreshToken = tokenStore.getRefreshToken()
      const supervisionId = getSupervisionSessionId()
      try {
        if (supervisionId) await adminApi.supervision.end(supervisionId).catch(() => undefined)
        if (refreshToken) await authApi.logout(refreshToken)
      } catch {
        // The local session ends regardless. The server session expires on its own.
      } finally {
        resetLocal(reason ?? null)
      }
    },
    [resetLocal],
  )

  const startSupervision = useCallback(async (targetUserPublicId: string, reason: string) => {
    const session = await adminApi.supervision.start(targetUserPublicId, reason)
    setSupervisionSession(session.publicId)
    sessionStorage.setItem(SUPERVISION_DETAIL_KEY, JSON.stringify(session))
    setSupervision(session)
    return session
  }, [])

  const endSupervision = useCallback(async () => {
    const id = getSupervisionSessionId()
    // Stop sending the header first, so the closing call is made with the administrator's own authority.
    setSupervisionSession(null)
    sessionStorage.removeItem(SUPERVISION_DETAIL_KEY)
    setSupervision(null)
    if (id) await adminApi.supervision.end(id)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const own = new Set(principal?.permissions ?? [])
    // Supervision is read-only. Inside the supervised workspace, controls
    // render from the session's permissions alone (the target's non-mutating
    // ones), so the administrator never sees a sign or approve button that the
    // server would refuse. Elsewhere, the administrator's own apply.
    const supervised = new Set(supervision?.availablePermissions ?? [])
    const permissionsHere = () =>
      supervision && window.location.pathname.startsWith(supervision.dashboardRoute) ? supervised : own
    const roles = new Set(principal?.roles ?? [])
    return {
      status,
      principal,
      endedReason,
      clearEndedReason: () => setEndedReason(null),
      can: (permission) => permissionsHere().has(permission),
      canOwn: (permission) => own.has(permission),
      hasRole: (...codes) => codes.some((c) => roles.has(c)),
      completeSignIn,
      signOut,
      reloadPrincipal: async () => {
        await loadPrincipal()
      },
      supervision,
      startSupervision,
      endSupervision,
    }
  }, [status, principal, endedReason, completeSignIn, signOut, loadPrincipal, supervision, startSupervision, endSupervision])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
