import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import type { ErrorResponse, LoginResponse } from './types'

const API_ROOT = `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')}/api/v1`

/*
  Token handling.

  The access token lives in memory only. It is short-lived (15 minutes) and a
  reload simply refreshes it.

  The refresh token has to survive a reload, and the backend returns it in the
  response body, so it sits in sessionStorage: scoped to this tab, gone when
  the tab closes. It is readable by script on this origin, which is why the
  app loads no third-party script and why moving the refresh token to an
  httpOnly cookie is on the Phase 4 hardening list.
*/
const REFRESH_KEY = 'fnph.session.rt'
const SUPERVISION_KEY = 'fnph.session.viewAs'

let accessToken: string | null = null
let supervisionSessionId: string | null = sessionStorage.getItem(SUPERVISION_KEY)

export const tokenStore = {
  hasRefreshToken: () => Boolean(sessionStorage.getItem(REFRESH_KEY)),
  getRefreshToken: () => sessionStorage.getItem(REFRESH_KEY),
  setFromLogin(response: LoginResponse) {
    if (!response.accessToken || !response.refreshToken) {
      throw new Error('Sign-in response did not include tokens')
    }
    accessToken = response.accessToken
    sessionStorage.setItem(REFRESH_KEY, response.refreshToken)
  },
  clear() {
    accessToken = null
    sessionStorage.removeItem(REFRESH_KEY)
    setSupervisionSession(null)
  },
}

export function setSupervisionSession(id: string | null) {
  supervisionSessionId = id
  if (id) sessionStorage.setItem(SUPERVISION_KEY, id)
  else sessionStorage.removeItem(SUPERVISION_KEY)
}

export function getSupervisionSessionId() {
  return supervisionSessionId
}

/** Fired when the session cannot be renewed. The auth provider listens. */
export const sessionEvents = new EventTarget()
export const SESSION_EXPIRED = 'session-expired'

export class ApiError extends Error {
  readonly status: number
  readonly validationErrors: Record<string, string>
  readonly isNetworkError: boolean

  constructor(message: string, status: number, validationErrors: Record<string, string> = {}, isNetworkError = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.validationErrors = validationErrors
    this.isNetworkError = isNetworkError
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'Some details need attention. Check the form and try again.',
  401: 'Your session has ended. Sign in again to continue.',
  403: 'Your account does not have access to this.',
  404: 'That record could not be found.',
  409: 'This changed while you were working on it. Reload and try again.',
  413: 'That file is larger than the allowed size.',
  429: 'Too many attempts. Wait a few minutes before trying again.',
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<ErrorResponse>
    if (!ax.response) {
      return new ApiError('The service could not be reached. Check your connection and try again.', 0, {}, true)
    }
    const { status, data } = ax.response
    const serverMessage = typeof data === 'object' && data?.message ? data.message : undefined
    const message =
      serverMessage ||
      FALLBACK_MESSAGES[status] ||
      (status >= 500 ? 'The service hit a problem. Try again shortly. If it continues, contact the helpdesk.' : 'The request could not be completed.')
    return new ApiError(message, status, (typeof data === 'object' && data?.validationErrors) || {})
  }
  return new ApiError(error instanceof Error ? error.message : 'Something went wrong.', 0)
}

export const http = axios.create({
  baseURL: API_ROOT,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`)
  if (supervisionSessionId) config.headers.set('X-View-As-Session', supervisionSessionId)
  return config
})

/*
  One refresh at a time. Refresh tokens rotate and a reused one revokes the
  whole sign-in, so two parallel refreshes would sign the user out. Every 401
  waits on the same promise.
*/
let refreshInFlight: Promise<LoginResponse> | null = null

export function refreshSession(): Promise<LoginResponse> {
  if (!refreshInFlight) {
    const refreshToken = tokenStore.getRefreshToken()
    if (!refreshToken) return Promise.reject(new ApiError('No session to renew.', 401))
    refreshInFlight = axios
      .post<LoginResponse>(`${API_ROOT}/auth/refresh`, { refreshToken }, { timeout: 20_000 })
      .then(({ data }) => {
        tokenStore.setFromLogin(data)
        return data
      })
      .catch((err) => {
        const apiError = toApiError(err)
        // A network failure is not a revoked session. Keep the token and let the caller retry.
        if (!apiError.isNetworkError) tokenStore.clear()
        throw apiError
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

// Public sign-in steps answer 401 for a wrong password, which is not an expired session.
const PUBLIC_AUTH_CALL = /^\/auth\/(login|mfa\/|refresh|activation|logout|password\/(forgot|reset))/

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // A blob request returns its error body as a Blob too. Decode it so the
    // server's message ("That document expired on ...") reaches the person.
    if (error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text())
      } catch {
        error.response.data = undefined
      }
    }
    const config = error.config as RetriableConfig | undefined
    const status = error.response?.status
    const isAuthCall = PUBLIC_AUTH_CALL.test(config?.url ?? '')
    if (status === 401 && config && !config._retried && !isAuthCall && tokenStore.hasRefreshToken()) {
      config._retried = true
      try {
        await refreshSession()
        return http(config)
      } catch (refreshError) {
        const apiError = toApiError(refreshError)
        if (!apiError.isNetworkError) sessionEvents.dispatchEvent(new Event(SESSION_EXPIRED))
        throw apiError
      }
    }
    if (status === 401 && !isAuthCall) {
      tokenStore.clear()
      sessionEvents.dispatchEvent(new Event(SESSION_EXPIRED))
    }
    throw toApiError(error)
  },
)

/** Typed helpers that unwrap the response body. */
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => http.get<T>(url, config).then((r) => r.data),
  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => http.post<T>(url, body, config).then((r) => r.data),
  put: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => http.put<T>(url, body, config).then((r) => r.data),
  delete: <T>(url: string, config?: AxiosRequestConfig) => http.delete<T>(url, config).then((r) => r.data),
}

/** Path segment encoder for public IDs and keys taken from responses. */
export const seg = (value: string) => encodeURIComponent(value)
