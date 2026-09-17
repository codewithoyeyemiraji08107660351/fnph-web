import { api, seg } from '../http'
import type {
  AuditChainVerification,
  AuditEntry,
  CentreRow,
  ConfigurationChange,
  ConfigurationItem,
  CreateStaffUserRequest,
  Page,
  PermissionItem,
  RoleDetail,
  RoleScope,
  RoleSummary,
  StaffUserResponse,
  StaffUserRow,
  UserRoleAssignment,
  UserStatus,
  ViewAsSession,
} from '../types'

export interface UserSearch {
  term?: string
  status?: UserStatus | ''
  page?: number
  size?: number
}

export interface AuditSearch {
  action?: string
  entityType?: string
  from?: string
  to?: string
  page?: number
  size?: number
}

const clean = <T extends object>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))

export const adminApi = {
  users: {
    list: (q: UserSearch) => api.list<StaffUserRow>('/admin/users', { params: clean(q) }),
    get: (id: string) => api.get<StaffUserRow>(`/admin/users/${seg(id)}`),
    invite: (body: CreateStaffUserRequest) => api.post<StaffUserResponse>('/admin/users', body),
    resendInvitation: (id: string) => api.post<StaffUserResponse>(`/admin/users/${seg(id)}/invitation`),
    updateContact: (id: string, changes: { firstName?: string; lastName?: string; email?: string; phoneNumber?: string }) =>
      api.put<StaffUserRow>(`/admin/users/${seg(id)}`, null, { params: clean(changes) }),
    deactivate: (id: string, reason: string) => api.post<void>(`/admin/users/${seg(id)}/deactivate`, { reason }),
    resetPassword: (id: string, reason: string) =>
      api.post<void>(`/admin/users/${seg(id)}/reset-password`, null, { params: { reason } }),
    revokeSessions: (id: string) => api.delete<string>(`/admin/users/${seg(id)}/sessions`),
    resetMfa: (id: string) => api.delete<void>(`/admin/users/${seg(id)}/mfa`),
    roles: (id: string) => api.get<UserRoleAssignment>(`/admin/users/${seg(id)}/roles`),
    assignRoles: (id: string, body: { roleCodes: string[]; primaryRoleCode: string; reason: string }) =>
      api.put<UserRoleAssignment>(`/admin/users/${seg(id)}/roles`, body),
  },
  roles: {
    list: (scope?: RoleScope) => api.list<RoleSummary>('/admin/roles', { params: clean({ scope }) }),
    get: (code: string) => api.get<RoleDetail>(`/admin/roles/${seg(code)}`),
    permissions: () => api.get<Record<string, PermissionItem[]>>('/admin/permissions'),
  },
  centres: {
    list: () => api.list<CentreRow>('/admin/centres'),
  },
  supervision: {
    start: (targetUserPublicId: string, reason: string) =>
      api.post<ViewAsSession>('/admin/supervision', { targetUserPublicId, reason }),
    end: (sessionPublicId: string) => api.delete<void>(`/admin/supervision/${seg(sessionPublicId)}`),
    trail: (viewAsSessionId: number) => api.list<AuditEntry>(`/admin/audit/supervision/${viewAsSessionId}`),
  },
  audit: {
    search: (q: AuditSearch) => api.get<Page<AuditEntry>>('/admin/audit', { params: clean(q) }),
    verify: () => api.get<AuditChainVerification>('/admin/audit/verify'),
  },
  configuration: {
    list: () => api.list<ConfigurationItem>('/admin/configuration'),
    history: (key: string) => api.list<ConfigurationChange>(`/admin/configuration/${seg(key)}/history`),
    update: (key: string, body: { value: string; reason: string; effectiveFrom?: string }) =>
      api.put<ConfigurationItem>(`/admin/configuration/${seg(key)}`, body),
  },
}
