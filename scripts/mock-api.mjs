// Development-only mock of the Phase 1 API, for UI review without the Spring
// Boot stack. Serves dist/ with an SPA fallback and answers /api/v1 routes
// with synthetic data. Never deploy this.
//
//   npm run build && node scripts/mock-api.mjs
//   admin / Prototype123456   then code 123456 (first sign-in enrols MFA)
//   doctor / Prototype123456  code 123456
//   nurse / Prototype123456   code 123456, must change password first
//   hub, ruth, him, pharm, lab: same password and code
//   204815 / Prototype123456  patient, no MFA. Triage question 2 answered Yes stops.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { handlePhase2, MOCK_ROOM_HTML } from './mock-phase2.mjs'
import { handlePhase3 } from './mock-phase3.mjs'
import { GRANTS } from './mock-grants.mjs'
import { handlePhase5 } from './mock-phase5.mjs'

const PORT = Number(process.env.PORT || 4173)
const DIST = resolve(process.cwd(), 'dist')
const now = () => new Date().toISOString()
const ago = (min) => new Date(Date.now() - min * 60000).toISOString()

const ADMIN_PERMS = GRANTS.CENTRAL_ADMINISTRATOR.split(' ')
const ROUTE = { CENTRE_HUB_COORDINATOR: '/centre', CENTRE_PHARMACY: '/centre/pharmacy', FINANCE: '/finance', ICT_SUPPORT: '/ict', HELPDESK: '/helpdesk', PATIENT: '/portal', DOCTOR: '/clinical', HUB_COORDINATOR: '/hub', NURSING: '/queues/nursing', HIM: '/queues/him', PHARMACIST: '/reviews/pharmacy', LABORATORY_TECHNICIAN: '/reviews/laboratory' }
const staff = (publicId, username, displayName, role, extra = {}) => ({
  publicId, username, displayName, scope: role === 'PATIENT' ? 'PATIENT' : role.startsWith('CENTRE_') ? 'CENTRE' : 'FNPH', primaryRole: role, dashboardRoute: ROUTE[role], roles: [role],
  permissions: GRANTS[role].split(' '), mfaEnabled: role !== 'PATIENT', mustChangePassword: false, ...extra,
})
const accounts = {
  admin: { publicId: 'U-ADMIN', username: 'admin', displayName: 'Amina Yusuf', scope: 'FNPH', primaryRole: 'CENTRAL_ADMINISTRATOR', dashboardRoute: '/admin', roles: ['CENTRAL_ADMINISTRATOR'], permissions: ADMIN_PERMS, mfaEnabled: false, mustChangePassword: false },
  ops: { publicId: 'U-OPS', username: 'ops', displayName: 'Tunde Adebayo', scope: 'FNPH', primaryRole: 'CENTRAL_ADMINISTRATOR', dashboardRoute: '/admin', roles: ['CENTRAL_ADMINISTRATOR'], permissions: ADMIN_PERMS, mfaEnabled: true, mustChangePassword: false },
  doctor: staff('U-DOC', 'doctor', 'Ibrahim Bello', 'DOCTOR'),
  hub: staff('U-HUB', 'hub', 'Hauwa Musa', 'HUB_COORDINATOR'),
  nurse: staff('U-NUR', 'nurse', 'Ruth Gambo', 'NURSING', { mustChangePassword: true }),
  ruth: staff('U-NUR2', 'ruth', 'Ruth Adeyemi', 'NURSING'),
  him: staff('U-HIM', 'him', 'Musa Danladi', 'HIM'),
  pharm: staff('U-PH', 'pharm', 'Chidi Okafor', 'PHARMACIST'),
  lab: staff('U-LAB', 'lab', 'Zainab Idris', 'LABORATORY_TECHNICIAN'),
  centre: staff('U-CEN', 'centre', 'Halima Yusuf', 'CENTRE_HUB_COORDINATOR', { centreId: 'C-KDN', centreName: 'Kaduna North Centre' }),
  zaria: staff('U-ZAR', 'zaria', 'Bello Sani', 'CENTRE_HUB_COORDINATOR', { centreId: 'C-ZAR', centreName: 'Zaria Centre' }),
  cpharm: staff('U-CPH', 'cpharm', 'Ngozi Eze', 'CENTRE_PHARMACY', { centreId: 'C-KDN', centreName: 'Kaduna North Centre' }),
  finance: staff('U-FIN', 'finance', 'Emeka Obi', 'FINANCE'),
  ict: staff('U-ICT', 'ict', 'Yakubu Dogo', 'ICT_SUPPORT'),
  helpdesk: staff('U-HD', 'helpdesk', 'Blessing Audu', 'HELPDESK'),
  '204815': staff('U-PT', '204815', 'Fatima Sani', 'PATIENT', { patientId: 'P-1' }),
}
const tokens = new Map()
let seq = 1
const token = (kind, user) => { const t = `${kind}-${seq++}`; tokens.set(t, user); return t }

const roles = [
  ['CENTRAL_ADMINISTRATOR', 'Central Administrator', 'FNPH', '/admin', 'System-wide administration, supervision and configuration', 58],
  ['HUB_COORDINATOR', 'Hub Coordinator', 'FNPH', '/hub', 'Booking approval, assignment, session oversight and bundle release', 31],
  ['DOCTOR', 'Doctor', 'FNPH', '/clinical', 'Pre-review, consultation and clinical authorship', 24],
  ['PHARMACIST', 'Pharmacist', 'FNPH', '/reviews/pharmacy', 'Prescription transcription and professional verification', 9],
  ['FINANCE', 'Finance Officer', 'FNPH', '/finance', 'Payment monitoring, reconciliation and centre wallet funding', 12],
  ['PATIENT', 'Patient', 'PATIENT', '/portal', 'Verified existing FNPH Kaduna patient', 14],
  ['CENTRE_HUB_COORDINATOR', 'Centre Hub Coordinator', 'CENTRE', '/centre', 'Centre patients, referrals, consultations and released bundles', 16],
].map(([code, name, scope, dashboardRoute, description, permissionCount]) => ({ code, name, scope, dashboardRoute, description, permissionCount, systemRole: true, active: true }))

const users = [
  { publicId: 'U-DOC', username: 'doctor', fullName: 'Ibrahim Bello', email: 'i.bello@fnphkaduna.gov.ng', phoneNumber: '08030000001', status: 'ACTIVE', mfaEnabled: true, accountLocked: false, failedLoginAttempts: 0, lastLoginAt: ago(3), roles: ['DOCTOR'] },
  { publicId: 'U-HUB', username: 'hub.coord', fullName: 'Hauwa Musa', email: 'h.musa@fnphkaduna.gov.ng', status: 'ACTIVE', mfaEnabled: true, accountLocked: false, failedLoginAttempts: 0, lastLoginAt: ago(20), roles: ['HUB_COORDINATOR'] },
  { publicId: 'U-PH', username: 'pharm.okafor', fullName: 'Chidi Okafor', email: 'c.okafor@fnphkaduna.gov.ng', status: 'ACTIVE', mfaEnabled: false, accountLocked: true, failedLoginAttempts: 5, lastLoginAt: ago(600), roles: ['PHARMACIST'] },
  { publicId: 'U-FIN', username: 'finance.adamu', fullName: 'Sani Adamu', email: 's.adamu@fnphkaduna.gov.ng', status: 'INVITED', mfaEnabled: false, accountLocked: false, failedLoginAttempts: 0, roles: ['FINANCE'] },
  { publicId: 'U-CTR', username: 'kdn.north', fullName: 'Grace Danjuma', email: 'kdn.north@kdsg.gov.ng', status: 'ACTIVE', mfaEnabled: true, accountLocked: false, failedLoginAttempts: 0, lastLoginAt: ago(90), roles: ['CENTRE_HUB_COORDINATOR'] },
]
const config = [
  ['consultation_fee_ngn', '10000', 'INTEGER', 'payment', 'Fee a patient pays for one FNPH consultation', '0', '1000000', true],
  ['centre_booking_charge_ngn', '5000', 'INTEGER', 'payment', 'Wallet deduction per approved centre booking', '0', '1000000', true],
  ['session_minutes_fnph', '30', 'INTEGER', 'scheduling', 'Length of an FNPH consultation', '15', '90', true],
  ['no_show_cutoff_minutes', '15', 'INTEGER', 'scheduling', 'Minutes after start before the link closes', '5', '30', true],
  ['clinical_emergency_number', '08032722243', 'STRING', 'contact', 'Number given to anyone who reaches an emergency stop path', null, null, true],
  ['helpdesk_email', 'support@fnphkaduna.gov.ng', 'STRING', 'contact', 'Helpdesk address shown to users', null, null, false],
  ['recording_enabled', 'false', 'BOOLEAN', 'consultation', 'Whether consultations may be recorded', null, null, true],
  ['session_inactivity_timeout_minutes', '30', 'INTEGER', 'security', 'Idle minutes before sign-out', '5', '120', false],
].map(([key, value, valueType, category, description, minValue, maxValue, requiresGovernance]) => ({ key, value, valueType, category, description, minValue, maxValue, requiresGovernance, effectiveFrom: ago(10000) }))
let supervision = null
const notifications = [
  { publicId: 'N1', type: 'VERIFICATION_REQUEST', subject: 'EHR verification request waiting', body: 'A patient could not match their EHR number and asked for help.', actionUrl: '/admin/audit', sharedWithRole: true, targetRole: 'HIM', read: false, createdAt: ago(12) },
  { publicId: 'N2', type: 'ACCOUNT_LOCKED', subject: 'Chidi Okafor was locked out', body: 'Five failed sign-ins in fifteen minutes.', actionUrl: '/admin/users/U-PH', sharedWithRole: false, read: false, createdAt: ago(55) },
]

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body === undefined ? '' : JSON.stringify(body))
}
const err = (res, status, message) => send(res, status, { status, message, timestamp: now() })
const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { r(d ? JSON.parse(d) : {}) } catch { r({}) } }) })

async function api(req, res, url) {
  const path = url.pathname.replace('/api/v1', '')
  const m = req.method
  const auth = (req.headers.authorization || '').replace('Bearer ', '')
  const me = tokens.get(auth)
  const body = m === 'GET' || m === 'DELETE' ? {} : await readBody(req)

  if (path === '/public/settings') return send(res, 200, Object.fromEntries(config.map((c) => [c.key, c.value])))
  if (path.startsWith('/verify/')) {
    const t = path.split('/')[2]
    return send(res, 200, t === 'valid-demo' ? { status: 'VALID', issueNumber: 'RX-2609-K7M4NPQR', documentType: 'PRESCRIPTION', issuedOn: '2026-09-14', expiresOn: '2026-09-21' } : { status: 'NOT_FOUND' })
  }
  if (path === '/auth/login') {
    const a = accounts[body.username]
    if (!a || body.password !== 'Prototype123456') return err(res, 401, 'The username or password is not correct.')
    if (a.scope === 'PATIENT') return send(res, 200, { status: 'AUTHENTICATED', accessToken: token('at', a), refreshToken: token('rt', a), expiresInSeconds: 900, dashboardRoute: a.dashboardRoute, primaryRole: a.primaryRole })
    return send(res, 200, { status: a.mfaEnabled ? 'MFA_REQUIRED' : 'MFA_ENROLMENT_REQUIRED', mfaToken: token('mfa', a), mfaExpiresInSeconds: 300 })
  }
  if (path === '/auth/mfa/enrol') return send(res, 200, { secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', provisioningUri: 'otpauth://totp/FNPH%20Kaduna%20Telepsychiatry:admin?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=FNPH' })
  if (path === '/auth/mfa/verify' || path === '/auth/mfa/activate') {
    const a = tokens.get(body.mfaToken)
    if (!a || (body.code !== '123456' && !String(body.code).includes('-'))) return err(res, 401, 'That code is not correct.')
    const enrolling = path.endsWith('activate')
    if (enrolling) a.mfaEnabled = true
    return send(res, 200, { status: 'AUTHENTICATED', accessToken: token('at', a), refreshToken: token('rt', a), expiresInSeconds: 900, dashboardRoute: a.dashboardRoute, primaryRole: a.primaryRole, recoveryCodes: enrolling ? ['7KQ2-M9XA', 'P4DT-8WZR', 'H3NB-6YCE', 'Q8VF-2LJS', 'T5RM-9KDH', 'B7XW-3PGN', 'C2ZL-5TQV', 'J9HD-4MXB', 'W6NP-8RCK', 'F3YT-7GLA'] : undefined })
  }
  if (path === '/auth/refresh') {
    const a = tokens.get(body.refreshToken)
    if (!a) return err(res, 401, 'Your session has ended.')
    tokens.delete(body.refreshToken)
    return send(res, 200, { status: 'AUTHENTICATED', accessToken: token('at', a), refreshToken: token('rt', a), expiresInSeconds: 900, dashboardRoute: a.dashboardRoute, primaryRole: a.primaryRole })
  }
  if (path === '/auth/logout') return send(res, 204)
  if (path === '/auth/activation' && m === 'GET') return url.searchParams.get('token') === 'demo' ? send(res, 200, { fullName: 'Sani Adamu', email: 's.adamu@fnphkaduna.gov.ng', username: 'finance.adamu', expiresAt: new Date(Date.now() + 72 * 3600e3).toISOString(), minimumPasswordLength: 12 }) : err(res, 400, 'This invitation link has expired or was replaced.')
  if (path === '/auth/password/forgot') return send(res, 202)

  if (!me || !auth.startsWith('at-')) return err(res, 401, 'Your session has ended.')
  if (path === '/me') return send(res, 200, me)
  if (path === '/auth/password/change') {
    if (body.currentPassword !== 'Prototype123456') return err(res, 400, 'Your current password is not correct')
    me.mustChangePassword = false
    return send(res, 204)
  }
  if (path === '/me/profile') return send(res, 200, { publicId: me.publicId, username: me.username, firstName: me.displayName.split(' ')[0], lastName: me.displayName.split(' ')[1], email: `${me.username}@fnphkaduna.gov.ng`, phoneNumber: '08030000000', mfaEnabled: me.mfaEnabled, lastLoginAt: ago(1) })
  if (path === '/sessions' && m === 'GET') return send(res, 200, [{ publicId: 'S1', deviceLabel: 'Chrome on Windows', ipAddress: '102.89.1.4', signedInAt: ago(5), lastSeenAt: ago(0), current: true }, { publicId: 'S2', deviceLabel: 'Safari on iOS', ipAddress: '105.112.3.9', signedInAt: ago(2000), lastSeenAt: ago(300), current: false }])
  if (path.startsWith('/sessions')) return send(res, 204)
  if (path === '/notifications/unread-count') return send(res, 200, { unread: notifications.filter((n) => !n.read).length })
  if (path === '/notifications') return send(res, 200, notifications)
  if (path === '/notifications/read-all') { notifications.forEach((n) => (n.read = true)); return send(res, 200, { marked: 2 }) }
  if (path.startsWith('/notifications/')) { const n = notifications.find((x) => x.publicId === path.split('/')[2]); if (n) n.read = true; return send(res, 204) }

  const viewAs = req.headers['x-view-as-session']
  const acting = viewAs && supervision && supervision.publicId === viewAs
    ? { ...me, publicId: supervision.targetUserPublicId, permissions: [...me.permissions, ...supervision.availablePermissions] }
    : me
  if (handlePhase5({ req, res, url, path, m, me: acting, body, send, err })) return
  if (handlePhase3({ req, res, url, path, m, me: acting, body, send, err, users })) return
  // Centre consultations reuse the FNPH room and record handlers.
  const p2path = path
    .replace(/^\/centre-consultations\/([^/]+)\/join\/doctor$/, '/consultations/$1/join/doctor')
    .replace(/^\/centre-consultations\/([^/]+)\/(identity-confirmed|modality|terminate)$/, '/consultations/$1/$2')
    .replace(/^\/clinical\/centre-consultations\//, '/clinical/consultations/')
  if (handlePhase2({ req, res, url, path: p2path, m, me: acting, body, send, err })) return
  if (!me.roles.includes('CENTRAL_ADMINISTRATOR')) return err(res, 403, 'Your account does not have access to this.')
  if (path === '/system/health') return send(res, 200, { checkedAt: now(), activeStaffAccounts: users.length, enrolmentAvailable: true })
  if (path === '/admin/users' && m === 'GET') {
    const term = (url.searchParams.get('term') || '').toLowerCase(); const st = url.searchParams.get('status')
    return send(res, 200, users.filter((u) => (!term || `${u.fullName} ${u.username} ${u.email}`.toLowerCase().includes(term)) && (!st || u.status === st)))
  }
  if (path === '/admin/users' && m === 'POST') {
    const u = { publicId: `U-${seq++}`, username: body.username, fullName: `${body.firstName} ${body.lastName}`, email: body.email, status: 'INVITED', roles: [body.primaryRoleCode], mfaEnabled: false }
    users.push(u); return send(res, 201, { ...u, primaryRoleCode: body.primaryRoleCode, primaryRoleName: body.primaryRoleCode, mfaRequired: true })
  }
  const userMatch = path.match(/^\/admin\/users\/([^/]+)(\/.*)?$/)
  if (userMatch) {
    const u = users.find((x) => x.publicId === decodeURIComponent(userMatch[1]))
    if (!u) return err(res, 404, 'No user with that id.')
    const sub = userMatch[2] || ''
    if (sub === '/roles' && m === 'GET') return send(res, 200, { userPublicId: u.publicId, username: u.username, displayName: u.fullName, primaryRole: u.roles[0], dashboardRoute: roles.find((r) => r.code === u.roles[0])?.dashboardRoute, roles: u.roles.map((c, i) => ({ code: c, name: roles.find((r) => r.code === c)?.name ?? c, primary: i === 0, grantedAt: ago(40000), grantedBy: 'admin', grantReason: 'Initial account setup' })), effectivePermissions: ['a', 'b', 'c'] })
    if (sub === '/roles' && m === 'PUT') { u.roles = [body.primaryRoleCode, ...body.roleCodes.filter((c) => c !== body.primaryRoleCode)]; return send(res, 200, {}) }
    if (sub === '/deactivate') { u.status = 'DEACTIVATED'; return send(res, 204) }
    if (sub === '/mfa') { u.mfaEnabled = false; return send(res, 204) }
    if (sub) return send(res, 200, u)
    return send(res, 200, u)
  }
  if (path === '/admin/roles') return send(res, 200, roles)
  if (path.startsWith('/admin/roles/')) {
    const r = roles.find((x) => x.code === path.split('/')[3])
    return send(res, 200, { ...r, permissionsByModule: { identity: [{ code: 'user.read', module: 'identity', description: 'View staff and centre user accounts' }, { code: 'user.create', module: 'identity', description: 'Create a user account' }], governance: [{ code: 'audit.read', module: 'governance', description: 'Read the audit log' }] } })
  }
  if (path === '/admin/centres') return send(res, 200, [{ publicId: 'C-KDN', code: 'KDN-N', name: 'Kaduna North Centre', lga: 'Kaduna North', status: 'ACTIVE', isActive: true, canReceiveReferrals: true }, { publicId: 'C-ZAR', code: 'ZAR', name: 'Zaria Centre', lga: 'Zaria', status: 'INACTIVE', isActive: false, canReceiveReferrals: false }])
  if (path === '/admin/supervision' && m === 'POST') {
    const u = users.find((x) => x.publicId === body.targetUserPublicId)
    const r = roles.find((x) => x.code === u.roles[0])
    supervision = { publicId: `V-${seq++}`, targetUserPublicId: u.publicId, targetUsername: u.username, targetFullName: u.fullName, targetRole: r.code, dashboardRoute: r.dashboardRoute, reason: body.reason, startedAt: now(), expiresAt: new Date(Date.now() + 30 * 60000).toISOString(), actionsPerformed: 0, availablePermissions: (GRANTS[r.code] ?? '').split(' ').filter((p) => p && p !== 'document.download' && /(\.read\w*|^queue\.\w+|^review\.(pharmacy|laboratory))$/.test(p)) }
    return send(res, 201, supervision)
  }
  if (path.startsWith('/admin/supervision/')) { supervision = null; return send(res, 204) }
  if (path === '/admin/audit/verify') return send(res, 200, { intact: true, entriesChecked: 18234, breaks: [] })
  if (path.startsWith('/admin/audit/supervision/')) return send(res, 200, [{ publicId: 'AS1', action: 'QUEUE_VIEWED', entityType: 'Appointment', performedAt: ago(4), systemAction: false }])
  if (path === '/admin/audit') {
    const rows = [
      ['LOGIN_SUCCESS', 'admin', 'Users', 'SUCCESS', null],
      ['USER_INVITED', 'admin', 'Users', 'SUCCESS', 'New finance officer for September intake'],
      ['LOGIN_FAILED', 'pharm.okafor', 'Users', 'DENIED', null],
      ['CONFIG_UPDATED', 'admin', 'SystemConfiguration', 'SUCCESS', 'Board approval FNPH/TP/2026/014'],
      ['QUEUE_VIEWED', 'admin', 'Appointment', 'SUCCESS', 'Checking HIM backlog for a support ticket'],
    ].map(([action, username, entityType, outcome, reason], i) => ({ publicId: `A${i}`, action, username, entityType, entityId: 100 + i, outcome, reason, ipAddress: '102.89.1.4', performedAt: ago(i * 37 + 2), systemAction: false, details: i === 3 ? '{"key":"consultation_fee_ngn","from":"8000","to":"10000"}' : null, viewAsSessionId: i === 4 ? 7 : null, effectivePrincipal: i === 4 ? 'hub.coord' : null }))
    return send(res, 200, { content: rows, totalElements: rows.length, totalPages: 1, number: 0, size: 50, first: true, last: true, empty: false })
  }
  if (path === '/admin/configuration') return send(res, 200, config)
  if (path.match(/^\/admin\/configuration\/[^/]+\/history$/)) return send(res, 200, [{ key: 'x', previousValue: '8000', newValue: '10000', reason: 'Board approval FNPH/TP/2026/014', changedBy: 'admin', changedAt: ago(9000) }])
  if (path.startsWith('/admin/configuration/') && m === 'PUT') {
    const c = config.find((x) => x.key === decodeURIComponent(path.split('/')[3])); c.value = body.value; return send(res, 200, c)
  }
  return err(res, 404, 'Not in the mock.')
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' }
createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (url.pathname.startsWith('/api/v1/')) return api(req, res, url)
  if (url.pathname === '/mock-room') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    return res.end(MOCK_ROOM_HTML)
  }
  let file = join(DIST, decodeURIComponent(url.pathname))
  try { if (!(await stat(file)).isFile()) throw 0 } catch { file = join(DIST, 'index.html') }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' })
  res.end(await readFile(file))
}).listen(PORT, () => console.log(`Mock API and built app on http://localhost:${PORT}`))
