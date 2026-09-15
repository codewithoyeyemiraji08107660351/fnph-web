import { lazy } from 'react'

// Administration is only ever opened by a handful of accounts, so it loads on demand.
export const Overview = lazy(() => import('@/pages/admin/Overview').then((m) => ({ default: m.Overview })))
export const Users = lazy(() => import('@/pages/admin/Users').then((m) => ({ default: m.Users })))
export const UserDetail = lazy(() => import('@/pages/admin/UserDetail').then((m) => ({ default: m.UserDetail })))
export const Roles = lazy(() => import('@/pages/admin/Roles').then((m) => ({ default: m.Roles })))
export const RoleDetail = lazy(() => import('@/pages/admin/Roles').then((m) => ({ default: m.RoleDetail })))
export const Supervision = lazy(() => import('@/pages/admin/Supervision').then((m) => ({ default: m.Supervision })))
export const Audit = lazy(() => import('@/pages/admin/Audit').then((m) => ({ default: m.Audit })))
export const Configuration = lazy(() => import('@/pages/admin/Configuration').then((m) => ({ default: m.Configuration })))
