// Development-only. The remaining endpoints: versions, lifecycle, records,
// uploads, document administration, follow-ups, recording.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { state as p2, PATIENTS } from './mock-phase2.mjs'

const at = (m) => new Date(Date.now() + m * 60_000).toISOString()
let seq = 900
const id = (p) => `${p}-${++seq}`
const PDF = readFileSync(resolve(process.cwd(), 'public/favicon-64.png'))

const consent = [
  { publicId: 'CD-FNPH-0', audience: 'FNPH_PATIENT', version: 'DRAFT-0', title: 'PLACEHOLDER - Consent', body: 'PLACEHOLDER - FNPH to supply the approved consent wording.', status: 'DRAFT', createdAt: at(-9000) },
  { publicId: 'CD-CEN-0', audience: 'CENTRE', version: 'DRAFT-0', title: 'PLACEHOLDER - Centre consent', body: 'PLACEHOLDER - FNPH to supply.', status: 'DRAFT', createdAt: at(-9000) },
]
const triage = [
  { publicId: 'TS-FNPH-0', audience: 'FNPH_PATIENT', version: 'DRAFT-0', status: 'DRAFT', createdAt: at(-9000), questions: [{ sequence: 1, questionText: 'PLACEHOLDER question', stopAnswer: 'YES', stopReason: 'PLACEHOLDER' }] },
]
const cancellations = []
const records = {
  'PR-P1': { publicId: 'PR-P1', ehrNumber: '204815', firstName: 'Fatima', lastName: 'Sani', phoneNumber: '08031234567', email: 'fatima@example.com', isActive: true, activatedAt: at(-40000), driftFlagged: false, eligibilityVerifiedBy: 'him', eligibilityVerifiedAt: at(-50000), patientId: 'P-1' },
  'PR-P3': { publicId: 'PR-P3', ehrNumber: '177420', firstName: 'Ibrahim', lastName: 'Musa', phoneNumber: '08030001111', email: null, isActive: true, activatedAt: at(-30000), driftFlagged: true, driftDetails: 'Phone number differs from the 1 September export', eligibilityVerifiedBy: 'him', eligibilityVerifiedAt: at(-31000) },
}
const uploads = []
const docs = { 'RX-2609-NOFILE': { publicId: 'DOC-NF', issueNumber: 'RX-2609-NOFILE', documentType: 'PRESCRIPTION', status: 'ACTIVE', issuedAt: at(-100), expiresAt: at(9000), downloadCount: 1, maxDownloads: 1, revokedReason: null, hasFile: false } }
const pending = [{ publicId: 'CV-1', ehrNumber: '188001', destinationMasked: 'Desk, main building', expiresAt: at(12), attempts: 0 }]

const view = (r) => { const { patientId, ...rest } = r; return rest }

export function handlePhase5({ req, res, url, path, m, me, body, send, err }) {
  const can = (p) => me.permissions.includes(p)
  const deny = () => (err(res, 403, 'Your account does not have access to this.'), true)
  const q = (k) => url.searchParams.get(k)

  // ----- versions -----
  if (path === '/admin/consent' || path === '/admin/triage') {
    if (!can('consent.manage_versions')) return deny()
    const store = path === '/admin/consent' ? consent : triage
    if (m === 'GET') return send(res, 200, store.filter((d) => d.audience === q('audience')).map((d) => ({ ...d, placeholder: JSON.stringify(d).includes('PLACEHOLDER') }))), true
    if (store.some((d) => d.audience === body.audience && d.version.toLowerCase() === body.version.toLowerCase())) return err(res, 409, `Version ${body.version} already exists for this audience. Use a new version.`), true
    const d = { publicId: id(path === '/admin/consent' ? 'CD' : 'TS'), ...body, status: 'DRAFT', createdAt: new Date().toISOString() }
    if (d.questions) d.questions = d.questions.map((x, i) => ({ ...x, sequence: i + 1 }))
    store.unshift(d)
    return send(res, 201, d), true
  }
  const ce = path.match(/^\/admin\/consent\/([^/]+)$/)
  if (ce && m === 'PUT') {
    const d = consent.find((x) => x.publicId === ce[1])
    if (d.status !== 'DRAFT') return err(res, 409, 'Only a draft can be edited.'), true
    Object.assign(d, body)
    return send(res, 200, d), true
  }
  const pub = path.match(/^\/admin\/(consent|triage)\/([^/]+)\/publish$/)
  if (pub) {
    const store = pub[1] === 'consent' ? consent : triage
    const d = store.find((x) => x.publicId === pub[2])
    if (JSON.stringify(d).includes('PLACEHOLDER')) return err(res, 409, 'That text still contains PLACEHOLDER. Replace it with the approved wording before publishing.'), true
    store.filter((x) => x.audience === d.audience && x.status === 'PUBLISHED').forEach((x) => { x.status = 'RETIRED'; x.retiredAt = new Date().toISOString() })
    Object.assign(d, { status: 'PUBLISHED', effectiveFrom: new Date().toISOString(), publishedBy: me.username })
    if (pub[1] === 'consent' && d.audience === 'FNPH_PATIENT') p2.consentVersion = d.version
    return send(res, 200, {}), true
  }

  // ----- lifecycle -----
  const cr = path.match(/^\/appointments\/([^/]+)\/(cancel-request|reschedule|no-show)$/)
  if (cr) {
    const a = p2.appointments.find((x) => x.publicId === cr[1])
    if (!a || (me.patientId && a.patientId !== me.patientId)) return err(res, 404, 'No such appointment'), true
    if (cr[2] === 'cancel-request') {
      if (!['APPROVED', 'AWAITING_APPROVAL'].includes(a.status)) return err(res, 400, 'Only a pending or confirmed appointment can be cancelled.'), true
      const hours = Math.floor((new Date(a.appointmentDate) - Date.now()) / 3_600_000)
      const r = { publicId: id('CXL'), appointment: a.publicId, requestType: q('requestType'), reason: q('reason'), hoursNotice: hours, requestedAt: new Date().toISOString(), requestedBy: me.username, status: 'SUBMITTED' }
      cancellations.push(r)
      return send(res, 201, { publicId: r.publicId, hoursNotice: hours, requiredNoticeHours: 24, withinNoticePeriod: hours >= 24, status: 'SUBMITTED' }), true
    }
    if (cr[2] === 'reschedule') {
      const [, d, idx] = (q('newSlotPublicId') || '').match(/^S-(\d{4}-\d{2}-\d{2})-(\d+)$/) ?? []
      if (!d) return err(res, 400, 'That time has been taken. Choose another.'), true
      const start = new Date(`${d}T${String(8 + Number(idx)).padStart(2, '0')}:00:00Z`)
      Object.assign(a, { appointmentDate: start.toISOString(), scheduledEndAt: new Date(start.getTime() + 30 * 60_000).toISOString(), status: 'AWAITING_APPROVAL', doctor: null, room: null })
      return send(res, 200, { reference: a.reference, newTime: a.appointmentDate, status: a.status }), true
    }
    if (!can('appointment.mark_no_show')) return deny()
    if (new Date(a.appointmentDate) > new Date()) return err(res, 409, 'That appointment has not started yet'), true
    a.status = 'NO_SHOW'
    return send(res, 204), true
  }
  if (path === '/appointments/cancellations') {
    return send(res, 200, cancellations.filter((c) => c.status === 'SUBMITTED').map((c) => {
      const a = p2.appointments.find((x) => x.publicId === c.appointment)
      return { publicId: c.publicId, appointmentReference: a.reference, appointmentPublicId: a.publicId, appointmentDate: a.appointmentDate, appointmentStatus: a.status, patientName: PATIENTS[a.patientId].name, requestType: c.requestType, reason: c.reason, hoursNotice: c.hoursNotice, requestedAt: c.requestedAt, requestedBy: c.requestedBy, proposedTime: null }
    })), true
  }
  const dc = path.match(/^\/appointments\/cancellations\/([^/]+)\/decide$/)
  if (dc) {
    if (!can('appointment.approve')) return deny()
    const c = cancellations.find((x) => x.publicId === dc[1])
    if (c.status !== 'SUBMITTED') return err(res, 409, 'That request has already been decided'), true
    if (q('approve') !== 'true' && !q('notes')) return err(res, 400, 'Say why, so the patient knows what to do next.'), true
    c.status = q('approve') === 'true' ? 'APPROVED' : 'REFUSED'
    if (c.status === 'APPROVED') p2.appointments.find((x) => x.publicId === c.appointment).status = 'CANCELLED'
    return send(res, 204), true
  }
  if (path === '/appointments/day') {
    const d = q('date')
    return send(res, 200, p2.appointments.filter((a) => !a.centre && new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date(a.appointmentDate)) === d).map((a) => ({ publicId: a.publicId, reference: a.reference, status: a.status, appointmentDate: a.appointmentDate, scheduledEndAt: a.scheduledEndAt, room: a.room, patientName: PATIENTS[a.patientId].name, ehrNumber: PATIENTS[a.patientId].ehr, doctorName: a.doctor === 'U-DOC' ? 'Ibrahim Bello' : null }))), true
  }

  // ----- patient records -----
  if (path === '/patients/me') { const r = Object.values(records).find((x) => x.patientId === me.patientId); return r ? send(res, 200, view(r)) : err(res, 404, 'No patient record on this account'), true }
  if (path === '/patients' && m === 'GET') {
    if (!can('patient.read')) return deny()
    const t = (q('term') || '').toLowerCase()
    return send(res, 200, Object.values(records).filter((r) => !t || `${r.firstName} ${r.lastName} ${r.ehrNumber} ${r.phoneNumber}`.toLowerCase().includes(t)).map(view)), true
  }
  if (path === '/patients/drift') return can('patient.flag_drift') ? (send(res, 200, Object.values(records).filter((r) => r.driftFlagged).map((r) => ({ publicId: r.publicId, ehrNumber: r.ehrNumber, name: `${r.firstName} ${r.lastName}`, flaggedAt: at(-600), details: r.driftDetails }))), true) : deny()
  const pr = path.match(/^\/patients\/([^/]+)(?:\/(deactivate|drift\/clear))?$/)
  if (pr && pr[1] !== 'me') {
    const r = records[pr[1]]
    if (!r) return err(res, 404, 'No such patient'), true
    if (!pr[2] && m === 'GET') return send(res, 200, view(r)), true
    if (!pr[2] && m === 'PUT') { if (!can('patient.update')) return deny(); ['phoneNumber', 'email'].forEach((k) => { if (q(k) !== null) r[k] = q(k) }); return send(res, 200, { updated: true }), true }
    if (pr[2] === 'deactivate') { r.isActive = false; return send(res, 204), true }
    if (pr[2] === 'drift/clear') { r.driftFlagged = false; r.driftDetails = null; return send(res, 204), true }
  }
  if (path === '/admin/patients' && m === 'POST') {
    if (!can('patient.create')) return deny()
    if (!q('verifiedHow')) return err(res, 400, 'Say how this person was verified.'), true
    if (Object.values(records).some((r) => r.ehrNumber === q('ehrNumber'))) return err(res, 400, `A patient already exists for ${q('ehrNumber')}`), true
    const r = { publicId: id('PR'), ehrNumber: q('ehrNumber'), firstName: q('firstName'), lastName: q('lastName'), phoneNumber: q('phoneNumber'), email: q('email'), isActive: false, driftFlagged: false }
    records[r.publicId] = r
    return send(res, 201, { publicId: r.publicId, ehrNumber: r.ehrNumber, active: false, next: 'Record the eligibility check, then activate' }), true
  }
  const mp = path.match(/^\/admin\/patients\/([^/]+)\/(verify|activate)$/)
  if (mp) {
    const r = records[mp[1]]
    if (mp[2] === 'verify') { if (!can('patient.verify')) return deny(); Object.assign(r, { eligibilityVerifiedBy: me.username, eligibilityVerifiedAt: new Date().toISOString() }); return send(res, 204), true }
    if (!can('patient.activate')) return deny()
    if (!r.eligibilityVerifiedAt) return err(res, 409, 'Record the eligibility check first.'), true
    Object.assign(r, { isActive: true, activatedAt: new Date().toISOString() })
    const sent = !!r.email
    return send(res, 200, { username: r.ehrNumber, status: 'INVITED', setupLinkSent: sent, note: sent ? 'A setup link was emailed to the address on the patient record.' : 'No email is on the patient record, so no setup link was sent.' }), true
  }
  if (path === '/admin/enrolment/pending-codes') return can('enrolment.release_code') ? (send(res, 200, pending), true) : deny()
  const fr = path.match(/^\/finance\/reports\/patient\/([^/]+)$/)
  if (fr) return send(res, 200, { name: 'patient_payments', generatedAt: new Date().toISOString(), freshness: 'live', rowCount: 1, rows: [{ reference: 'FNPH-12', status: 'SUCCESS', amount: 10000, verifiedAt: at(-900) }] }), true

  // ----- uploads -----
  if (path === '/uploads' && m === 'POST') {
    if (!can('upload.create')) return deny()
    const u = { publicId: id('UP'), originalFileName: 'result.pdf', contentType: 'application/pdf', sizeBytes: 48213, category: q('category'), scanStatus: 'CLEAN', description: q('description'), uploadedBy: me.username, uploadedAt: new Date().toISOString(), referenceId: q('referenceId'), owner: me.publicId, centreId: me.centreId ?? null }
    uploads.unshift(u)
    return send(res, 201, u), true
  }
  if (path === '/uploads/mine') return can('upload.read_own') ? (send(res, 200, uploads.filter((u) => u.owner === me.publicId && !u.deleted)), true) : deny()
  if (path === '/uploads' && m === 'GET') {
    if (!can('upload.read')) return deny()
    return send(res, 200, uploads.filter((u) => !u.deleted && u.referenceId === q('referenceId') && (!me.centreId || u.centreId === me.centreId))), true
  }
  const up = path.match(/^\/(?:admin\/)?uploads\/([^/]+)(?:\/(content|quarantine))?$/)
  if (up && up[1] !== 'quarantined' && up[1] !== 'mine') {
    const u = uploads.find((x) => x.publicId === up[1])
    if (!u) return err(res, 404, 'No such file'), true
    if (up[2] === 'content') { res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${u.originalFileName}"` }); res.end(PDF); return true }
    if (up[2] === 'quarantine') { if (!can('upload.quarantine')) return deny(); u.scanStatus = 'QUARANTINED'; return send(res, 204), true }
    if (m === 'DELETE') { if (!can('upload.delete')) return deny(); u.deleted = true; return send(res, 204), true }
  }

  // ----- documents -----
  const dl = path.match(/^\/clinical\/documents\/([^/]+)$/)
  if (dl) {
    if (!can('document.read')) return deny()
    const d = docs[decodeURIComponent(dl[1])] ?? Object.values(docs).find((x) => x.issueNumber === decodeURIComponent(dl[1]))
    if (!d) return err(res, 404, 'No document with that number'), true
    const { hasFile, ...v } = d
    return send(res, 200, v), true
  }
  if (path === '/admin/documents/reissue') {
    const d = docs[q('issueNumber')]
    if (!d) return err(res, 404, `No document with issue number ${q('issueNumber')}`), true
    if (d.hasFile) return err(res, 409, 'That document already has a file. Re-rendering would replace a file the patient may already have downloaded.'), true
    d.hasFile = true
    return send(res, 200, { issueNumber: d.issueNumber, note: 'File rendered.' }), true
  }
  const ad = path.match(/^\/admin\/documents\/([^/]+)\/allow-download$/)
  if (ad) {
    const d = docs[decodeURIComponent(ad[1])]
    if (!q('reason') || q('reason').length < 10) return err(res, 400, 'Say why another download is allowed, in at least 10 characters.'), true
    if (d.downloadCount < d.maxDownloads) return err(res, 409, 'The patient still has a download available.'), true
    d.maxDownloads += 1
    return send(res, 200, { downloadCount: d.downloadCount, maxDownloads: d.maxDownloads }), true
  }
  const rv = path.match(/^\/documents\/([^/]+)\/revoke$/)
  if (rv) {
    if (!can('document.revoke')) return deny()
    const d = Object.values(docs).find((x) => x.publicId === rv[1])
    Object.assign(d, { status: 'REVOKED', revokedReason: q('reason') })
    return send(res, 200, {}), true
  }

  // ----- follow-ups, triage history, recording, quality, legacy join -----
  if (path === '/clinical/follow-ups/mine') return can('follow_up.read_own') ? (send(res, 200, [{ publicId: 'F-1', recommendation: 'Review in six weeks. Keep a sleep diary.', reviewInterval: '6 weeks', preferredDate: null, createdAt: at(-1500) }]), true) : deny()
  const fu = path.match(/^\/clinical\/follow-ups\/([^/]+)$/)
  if (fu) return send(res, 200, { publicId: fu[1], recommendation: 'Review in six weeks.', reviewInterval: '6 weeks' }), true
  if (path === '/triage/mine') return send(res, 200, p2.triage.map((t) => ({ publicId: t.publicId, version: 'T1', outcome: t.outcome, stopReason: t.stopReason, submittedAt: new Date().toISOString() }))), true
  if (/^\/consultations\/[^/]+\/recording\/start$/.test(path)) return err(res, 409, 'Recording is disabled. It stays off until FNPH have agreed consent, retention, access, data location, deletion and incident response.'), true
  if (/^\/consultations\/[^/]+\/recording$/.test(path)) return can('recording.read') ? (send(res, 200, []), true) : deny()
  if (/^\/consultations\/[^/]+\/quality$/.test(path)) { p2.qualityReports = (p2.qualityReports ?? 0) + 1; return send(res, 204), true }
  const lj = path.match(/^\/consultations\/centre\/([^/]+)\/join$/)
  if (lj) {
    const a = p2.appointments.find((x) => x.publicId === lj[1] && x.centre === me.centreId)
    if (!a) return err(res, 404, 'No such consultation'), true
    return send(res, 200, { reference: a.reference, appointmentDateTime: a.appointmentDate, room: String(a.room), isOwner: false, note: 'The FNPH clinician controls the session. You are a participant.' }), true
  }
  return false
}
