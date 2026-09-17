import { api } from '../http'
import type { ActivationPreview, LoginResponse, MfaEnrolmentResponse, Principal, SessionItem } from '../types'

export function deviceLabel(): string {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'device'
  return `${browser} on ${os}`
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username: username.trim(), password, deviceLabel: deviceLabel() }),
  verifyMfa: (mfaToken: string, code: string) => api.post<LoginResponse>('/auth/mfa/verify', { mfaToken, code: code.trim() }),
  beginMfaEnrolment: (mfaToken: string) =>
    api.post<MfaEnrolmentResponse>('/auth/mfa/enrol', null, { params: { mfaToken } }),
  activateMfa: (mfaToken: string, code: string) => api.post<LoginResponse>('/auth/mfa/activate', { mfaToken, code: code.trim() }),
  logout: (refreshToken: string) => api.post<void>('/auth/logout', { refreshToken }),
  previewActivation: (token: string) => api.get<ActivationPreview>('/auth/activation', { params: { token } }),
  completeActivation: (token: string, password: string) => api.post<void>('/auth/activation', { token, password }),
  forgotPassword: (identifier: string) => api.post<void>('/auth/password/forgot', { identifier: identifier.trim() }),
  resetPassword: (token: string, password: string) => api.post<void>('/auth/password/reset', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>('/auth/password/change', { currentPassword, newPassword }),
  me: () => api.get<Principal>('/me'),
  sessions: () => api.list<SessionItem>('/sessions'),
  revokeSession: (publicId: string) => api.delete<void>(`/sessions/${encodeURIComponent(publicId)}`),
  revokeAllSessions: () => api.delete<void>('/sessions'),
}
