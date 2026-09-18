// Development-only. Centres (Phase 3) and operations (Phase 4) on top of the
// Phase 2 state, so centre consultations reuse the same room and record logic.
import { state as p2, PATIENTS } from './mock-phase2.mjs'

const at = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString()
const watDay = (offset) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date(Date.now() + offset * 86_400_000))
let seq = 500
const id = (p) => `${p}-${++seq}`

const centres = [
  { publicId: 'C-KDN', code: 'KDN-N', name: 'Kaduna North Centre', lga: 'Kaduna North', status: 'ACTIVE', suspendReason: null, caps: { PHARMACY: true, LABORATORY: false, HIM: false } },
  { publicId: 'C-ZAR', code: 'ZAR', name: 'Zaria Centre', lga: 'Zaria', status: 'ACTIVE', suspendReason: null, caps: { PHARMACY: false, LABORATORY: false, HIM: false } },
]
const centrePatients = [
  { publicId: 'CP-1', centre: 'C-KDN', centrePatientId: 'KDN-0042', firstName: 'Musa', lastName: 'Garba', dateOfBirth: '1984-03-12', phoneNumber: '08031112222' },
  { publicId: 'CP-2', centre: 'C-ZAR', centrePatientId: 'ZAR-0007', firstName: 'Aisha', lastName: 'Bala', dateOfBirth: '1990-07-01', phoneNumber: '08035556666' },
]
const referrals = [
  { publicId: 'CR-1', centre: 'C-KDN', patient: 'CP-1', reference: 'REF-KDN-0001', status: 'DRAFT', urgency: 'ROUTINE', reason: 'Low mood for three months, poor sleep and loss of appetite. No prior psychiatric history at this centre.', createdAt: at(-300) },
  { publicId: 'CR-2', centre: 'C-ZAR', patient: 'CP-2', reference: 'REF-ZAR-0001', status: 'SUBMITTED', urgency: 'SOON', reason: 'Zaria referral that Kaduna North must never see.', createdAt: at(-200) },
]
const receipts = [
  { publicId: 'RC-1', centre: 'C-KDN', patient: 'CP-1', appointmentReference: 'CAPT-OLD1', deliveredAt: at(-90), outstanding: true, treated: false },
  { publicId: 'RC-2', centre: 'C-ZAR', patient: 'CP-2', appointmentReference: 'CAPT-ZAR1', deliveredAt: at(-60), outstanding: true, treated: false },
]
const CONSENT = { version: 'C-2026.1', title: 'Centre referral consultation consent', body: 'You are being referred to a specialist at FNPH Kaduna, who will see you by video while you are here at the centre with our staff.\n\nThe consultation is not recorded. Your information is shared only with the staff involved in your care.\n\nYou can stop at any time.' }

// A centre consultation for the doctor, live now, stored in the Phase 2 state so the room and record work unchanged.
PATIENTS['CP-1'] = { name: 'Musa Garba', ehr: 'KDN-0042' }
PATIENTS['CP-2'] = { name: 'Aisha Bala', ehr: 'ZAR-0007' }
p2.appointments.push({
  publicId: 'CA-LIVE', reference: 'CAPT-LIVE1', status: 'APPROVED', patientId: 'CP-1', centre: 'C-KDN', centreName: 'Kaduna North Centre',
  referralReason: 'Low mood and poor sleep for three months. Taking no medication.', referralReference: 'REF-KDN-0000',
  appointmentDate: at(3), scheduledEndAt: at(33), room: 'Centre Room A', doctor: 'U-DOC', pharmacist: 'U-PH', nursing: 'TREATED', himState: 'TREATED',
})

const publications = []
const rooms = [
  { publicId: 'RM-2', code: 'CR2', name: 'Consultation Room 2', roomType: 'PATIENT_SERVICE', active: true },
  { publicId: 'RM-3', code: 'CR3', name: 'Consultation Room 3', roomType: 'PATIENT_SERVICE', active: true },
  { publicId: 'RM-A', code: 'CRA', name: 'Centre Room A', roomType: 'CENTRE_CONSULTATION', active: true },
]
const rota = []
const templates = [
  { publicId: 'T-1', notificationType: 'APPOINTMENT_APPROVED', channel: 'SMS', subject: null, body: 'Your FNPH consultation on {date} at {time} is confirmed. Ref {reference}.', active: true },
  { publicId: 'T-2', notificationType: 'DOCUMENT_READY', channel: 'EMAIL', subject: 'Your documents are ready', body: 'Sign in to the FNPH patient portal to view your documents.', active: true },
]
const broadcasts = []
const wallets = { 'C-KDN': { balance: 45000, ledger: [{ reference: 'TSA-0001', direction: 'CREDIT', amount: 50000, balanceAfter: 50000, description: 'Opening fund', source: 'FINANCE', at: at(-5000) }, { reference: 'CAPT-OLD1', direction: 'DEBIT', amount: 5000, balanceAfter: 45000, description: 'Consultation', source: 'BOOKING', at: at(-100) }] }, 'C-ZAR': { balance: 2000, ledger: [] } }
const exceptions = [{ publicId: 'EX-1', type: 'AMOUNT_MISMATCH', expected: 10000, reported: 12000, details: 'Remita reported 12,000 for FNPH-77', raisedAt: at(-700) }]
const imports = [{ publicId: 'IMP-1', fileName: 'ehr-export-2026-09-01.csv', status: 'ACTIVE', sourceAsAt: '2026-09-01', ageInDays: 14, rowCount: 18204, validRowCount: 18190, rejectedRowCount: 14, validationReport: 'Row 88: missing date of birth\nRow 412: invalid phone', driftDetectedCount: 36, uploadedBy: 'ict', uploadedAt: at(-20000), activatedAt: at(-19000), activatedBy: 'admin' }]
const manualEhrRecords = [{ publicId: 'MEHR-1', version: 0, ehrNumber: '204815', fullName: 'Prototype Patient', dateOfBirth: '1990-04-12', phoneNumber: '08031234567', email: 'patient@example.test', clinic: 'General Adult Clinic', patientStatus: 'ACTIVE', active: true, syncStatus: 'DIFFERENT', updatedAt: at(-120), updatedBy: 'admin' }]
const verifications = [{ publicId: 'VR-1', ehrNumberClaimed: '301122', fullName: 'Grace Yohanna', dateOfBirth: '1979-11-02', phoneNumber: '08039990000', preferredContact: 'CALL', supportingNote: 'I changed my number last year.', status: 'SUBMITTED', submittedAt: at(-400) }]
const tickets = [{ publicId: 'TK-1', ticketNumber: 'SUP-0001', category: 'PAYMENT', priority: 'HIGH', status: 'OPEN', subject: 'Paid but booking not confirmed', escalatedToRole: null, firstResponseMinutes: null, resolutionSummary: null, createdAt: at(-240), raisedBy: 'U-PT', messages: [{ author: 'Fatima Sani', body: 'I paid with RRR 280007123456 but my booking still shows held.', internal: false, sentAt: at(-240) }] }]

const centreOf = (me) => me.centreId
const cp = (pid) => centrePatients.find((p) => p.publicId === pid)
const referralView = (r) => { const p = cp(r.patient); return { publicId: r.publicId, reference: r.reference, centrePatientId: p.centrePatientId, patientName: `${p.firstName} ${p.lastName}`, status: r.status, urgency: r.urgency, consentAcceptedAt: r.consentAt ?? null, consentWitnessedBy: r.witness ?? null, submittedAt: r.submittedAt ?? null, createdAt: r.createdAt } }
const receiptView = (r) => { const p = cp(r.patient); return { publicId: r.publicId, centrePatientId: p.centrePatientId, patientName: `${p.firstName} ${p.lastName}`, appointmentReference: r.appointmentReference, deliveredAt: r.deliveredAt, firstOpenedAt: null, outstanding: r.outstanding } }
const ticketView = ({ raisedBy, ...t }) => t

export function handlePhase3({ req, res, url, path, m, me, body, send, err, users }) {
  const can = (p) => me.permissions.includes(p)
  const deny = () => (err(res, 403, 'Your account does not have access to this.'), true)
  const q = (k) => url.searchParams.get(k)

  // ---------- centre portal (always scoped to the caller's centre) ----------
  if (path.startsWith('/centres/me')) {
    const cid = centreOf(me)
    if (!cid) return deny()
    const centre = centres.find((c) => c.publicId === cid)
    const sub = path.slice('/centres/me'.length)
    const util = () => ({
      referralsAwaitingScheduling: referrals.filter((r) => r.centre === cid && r.status === 'SUBMITTED').length,
      referralsScheduled: referrals.filter((r) => r.centre === cid && r.status === 'SCHEDULED').length,
      consultationsCompleted: p2.appointments.filter((a) => a.centre === cid && a.status === 'COMPLETED').length,
      bundlesAwaitingAction: receipts.filter((r) => r.centre === cid && !r.treated).length,
    })
    if (sub === '' ) return send(res, 200, { publicId: centre.publicId, code: centre.code, name: centre.name, lga: centre.lga, status: centre.status, capabilities: Object.entries(centre.caps).map(([capability, enabled]) => ({ capability, enabled })), utilisation: util() }), true
    if (sub === '/utilisation') return send(res, 200, util()), true
    if (sub === '/patients' && m === 'GET') {
      const term = (q('term') || '').toLowerCase()
      return send(res, 200, centrePatients.filter((p) => p.centre === cid && (!term || `${p.firstName} ${p.lastName} ${p.phoneNumber} ${p.centrePatientId}`.toLowerCase().includes(term))).map((p) => ({ publicId: p.publicId, centrePatientId: p.centrePatientId, name: `${p.firstName} ${p.lastName}`, dateOfBirth: p.dateOfBirth, phoneNumber: p.phoneNumber }))), true
    }
    if (sub === '/patients' && m === 'POST') {
      if (!can('centre_patient.create')) return deny()
      const p = { publicId: id('CP'), centre: cid, ...body }
      centrePatients.push(p)
      PATIENTS[p.publicId] = { name: `${p.firstName} ${p.lastName}`, ehr: p.centrePatientId ?? '' }
      return send(res, 201, { publicId: p.publicId, centrePatientId: p.centrePatientId ?? null, name: `${p.firstName} ${p.lastName}` }), true
    }
    const pr = sub.match(/^\/patients\/([^/]+)\/referrals$/)
    if (pr) {
      const p = cp(pr[1])
      if (!p || p.centre !== cid) return err(res, 404, 'No such patient at this centre'), true
      return send(res, 200, referrals.filter((r) => r.patient === p.publicId).map(referralView)), true
    }
    if (sub === '/referrals' && m === 'GET') return send(res, 200, referrals.filter((r) => r.centre === cid && (!q('status') || r.status === q('status'))).map(referralView)), true
    if (sub === '/referrals' && m === 'POST') {
      const p = cp(body.centrePatientPublicId)
      if (!p || p.centre !== cid) return err(res, 404, 'No such patient at this centre'), true
      if (!body.referralReason || body.referralReason.length < 20) return err(res, 400, 'Referral reason must be at least 20 characters.'), true
      const r = { publicId: id('CR'), centre: cid, patient: p.publicId, reference: `REF-${centre.code}-${seq}`, status: 'DRAFT', urgency: body.urgency ?? 'ROUTINE', reason: body.referralReason, createdAt: new Date().toISOString() }
      referrals.push(r)
      return send(res, 201, referralView(r)), true
    }
    const sm = sub.match(/^\/referrals\/([^/]+)\/submit$/)
    if (sm) {
      const r = referrals.find((x) => x.publicId === sm[1] && x.centre === cid)
      if (!r) return err(res, 404, 'No such referral'), true
      if (!['DRAFT', 'RETURNED'].includes(r.status)) return err(res, 409, 'That referral has already been submitted'), true
      if (q('consentVersion') !== CONSENT.version) return err(res, 400, 'The consent text has changed. Read the current version to the patient and submit again.'), true
      Object.assign(r, { status: 'SUBMITTED', witness: q('consentWitnessedBy'), consentAt: new Date().toISOString(), submittedAt: new Date().toISOString() })
      return send(res, 200, referralView(r)), true
    }
    if (sub === '/booking/times') {
      if (!can('appointment.request')) return deny()
      const d = q('date')
      return send(res, 200, [8, 9, 10].map((h) => ({ slotPublicId: `CS-${d}-${h}`, startAt: `${d}T${String(h).padStart(2, '0')}:00:00Z`, endAt: `${d}T${String(h).padStart(2, '0')}:45:00Z` }))), true
    }
    if (sub === '/booking/request') {
      if (!can('appointment.request')) return deny()
      const r = referrals.find((x) => x.publicId === q('referralPublicId') && x.centre === cid)
      if (!r || r.status !== 'SUBMITTED') return err(res, 409, 'Only a submitted referral can request a time.'), true
      const [, d, h] = q('slotPublicId').match(/^CS-(\d{4}-\d{2}-\d{2})-(\d+)$/)
      const start = `${d}T${h.padStart(2, '0')}:00:00Z`
      const a = { publicId: id('CA'), reference: `CAPT-${seq}`, status: 'AWAITING_APPROVAL', patientId: r.patient, centre: cid, centreName: centre.name, referralReason: r.reason, referralReference: r.reference, referral: r.publicId, appointmentDate: start, scheduledEndAt: new Date(new Date(start).getTime() + 45 * 60_000).toISOString(), room: null, nursing: 'TREATED', himState: 'UNTREATED' }
      p2.appointments.push(a)
      r.status = 'SCHEDULED'
      return send(res, 201, { publicId: a.publicId, reference: a.reference, appointmentDate: a.appointmentDate, status: a.status }), true
    }
    if (sub === '/appointments') {
      return send(res, 200, p2.appointments.filter((a) => a.centre === cid).map((a) => ({ publicId: a.publicId, reference: a.reference, status: a.status, appointmentDate: a.appointmentDate, scheduledEndAt: a.scheduledEndAt, joinWindowOpensAt: new Date(new Date(a.appointmentDate).getTime() - 15 * 60_000).toISOString(), room: a.room, patientName: PATIENTS[a.patientId].name, centrePatientId: PATIENTS[a.patientId].ehr, referralReference: a.referralReference ?? null, returnedReason: a.returnedReason ?? null }))), true
    }
    if (sub === '/incoming') return send(res, 200, receipts.filter((r) => r.centre === cid && !r.treated).map(receiptView)), true
    if (sub === '/treated') return send(res, 200, receipts.filter((r) => r.centre === cid && r.treated).map(receiptView)), true
    const tm = sub.match(/^\/incoming\/([^/]+)\/treated$/)
    if (tm) {
      if (!can('centre_bundle.mark_treated')) return deny()
      const r = receipts.find((x) => x.publicId === tm[1] && x.centre === cid)
      if (!r) return err(res, 404, 'No such bundle'), true
      if (!q('notes')) return err(res, 400, 'Record what was done.'), true
      Object.assign(r, { treated: true, outstanding: false })
      return send(res, 204), true
    }
    return err(res, 404, 'Not found'), true
  }
  if (path === '/consent/centre') return can('centre_referral.create') ? (send(res, 200, CONSENT), true) : deny()
  const cj = path.match(/^\/centre-consultations\/([^/]+)\/join\/centre$/)
  if (cj) {
    const a = p2.appointments.find((x) => x.publicId === cj[1] && x.centre === centreOf(me))
    if (!a) return err(res, 404, 'No such consultation'), true
    if (!['APPROVED', 'IN_PROGRESS'].includes(a.status)) return err(res, 409, 'That appointment is not confirmed, so there is nothing to join'), true
    if (Date.now() < new Date(a.appointmentDate).getTime() - 15 * 60_000) return err(res, 409, 'The consultation room opens 15 minutes before the appointment.'), true
    return send(res, 200, { consultationPublicId: `C-${a.publicId}`, roomUrl: `http://${req.headers.host}/mock-room`, token: `tok-centre-${seq++}`, scheduledStart: a.appointmentDate, scheduledEnd: a.scheduledEndAt, remainingSeconds: 1800, firstWarningMinutes: 5, secondWarningMinutes: 2, isOwner: false }), true
  }
  if (path === '/clinical/centre-consultations/mine') {
    if (!can('consultation.read')) return deny()
    return send(res, 200, p2.appointments.filter((a) => a.centre && a.doctor === me.publicId).map((a) => ({ appointmentPublicId: a.publicId, reference: a.reference, status: a.status, appointmentDate: a.appointmentDate, scheduledEndAt: a.scheduledEndAt, room: a.room, centreName: a.centreName, patientName: PATIENTS[a.patientId].name, centrePatientId: PATIENTS[a.patientId].ehr, referralReason: a.referralReason, consultationPublicId: p2.consultations[`C-${a.publicId}`] ? `C-${a.publicId}` : null }))), true
  }

  // ---------- hub: centre approvals ----------
  if (path === '/hub/centre-approvals') {
    if (!can('appointment.read')) return deny()
    return send(res, 200, p2.appointments.filter((a) => a.centre && a.status === 'AWAITING_APPROVAL').map((a) => ({ publicId: a.publicId, reference: a.reference, centre: a.centreName, patient: PATIENTS[a.patientId].name, centrePatientId: PATIENTS[a.patientId].ehr, appointmentDateTime: a.appointmentDate, referralReason: a.referralReason }))), true
  }
  const ca = path.match(/^\/hub\/centre-approvals\/([^/]+)\/(approve|return)$/)
  if (ca) {
    const a = p2.appointments.find((x) => x.publicId === ca[1] && x.centre)
    if (!a || a.status !== 'AWAITING_APPROVAL') return err(res, 409, 'Only a pending request can be decided'), true
    if (ca[2] === 'return') {
      a.status = 'REJECTED'; a.returnedReason = q('reason')
      const r = referrals.find((x) => x.publicId === a.referral); if (r) r.status = 'RETURNED'
      return send(res, 200, { reference: a.reference, status: a.status }), true
    }
    if (q('roomPublicId') !== 'RM-A') return err(res, 409, 'That room is not a centre consultation room.'), true
    Object.assign(a, { status: 'APPROVED', doctor: q('doctorPublicId'), room: 'Centre Room A', pharmacist: q('pharmacistPublicId') })
    wallets[a.centre].balance -= 5000
    return send(res, 200, { reference: a.reference, status: a.status, room: a.room }), true
  }

  // ---------- 4A scheduling ----------
  if (path === '/admin/schedules' && m === 'GET') {
    if (!can('schedule.read')) return deny()
    return send(res, 200, publications.filter((p) => p.serviceDate >= q('from') && p.serviceDate <= q('to')).map(({ slots, ...p }) => p)), true
  }
  if (path === '/admin/schedules' && m === 'POST') {
    if (publications.some((p) => p.audience === body.audience && p.serviceDate === body.serviceDate && p.status !== 'WITHDRAWN')) return err(res, 409, `A ${body.audience} schedule already exists for ${body.serviceDate}. Withdraw it before publishing another.`), true
    const minutes = body.audience === 'CENTRE' ? 45 : 30
    const typed = rooms.filter((r) => r.active && r.roomType === (body.audience === 'CENTRE' ? 'CENTRE_CONSULTATION' : 'PATIENT_SERVICE'))
    const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
    const slots = []
    for (let t = toMin(body.windowStart); t + minutes <= toMin(body.windowEnd); t += minutes) {
      for (const r of typed) {
        const start = new Date(`${body.serviceDate}T00:00:00+01:00`).getTime() + t * 60_000
        slots.push({ publicId: id('SL'), startAt: new Date(start).toISOString(), endAt: new Date(start + minutes * 60_000).toISOString(), state: 'AVAILABLE', room: r.code, blockedReason: null })
      }
    }
    const pub = { publicId: id('PUB'), audience: body.audience, serviceDate: body.serviceDate, windowStart: body.windowStart, windowEnd: body.windowEnd, slotMinutes: minutes, status: body.publishImmediately ? 'PUBLISHED' : 'DRAFT', slotsGenerated: slots.length, publishedBy: body.publishImmediately ? me.username : null, publishedAt: body.publishImmediately ? new Date().toISOString() : null, withdrawReason: null, slots }
    publications.push(pub)
    const { slots: _s, ...view } = pub
    return send(res, 201, view), true
  }
  const pm = path.match(/^\/admin\/schedules\/([^/]+)\/(slots|publish|withdraw)$/)
  if (pm) {
    const pub = publications.find((p) => p.publicId === pm[1])
    if (!pub) return err(res, 404, 'No such schedule'), true
    if (pm[2] === 'slots') return send(res, 200, pub.slots), true
    if (pm[2] === 'publish') Object.assign(pub, { status: 'PUBLISHED', publishedBy: me.username, publishedAt: new Date().toISOString() })
    if (pm[2] === 'withdraw') { Object.assign(pub, { status: 'WITHDRAWN', withdrawReason: q('reason') }); pub.slots.forEach((s) => { if (s.state === 'AVAILABLE') Object.assign(s, { state: 'BLOCKED', blockedReason: q('reason') }) }) }
    const { slots: _s, ...view } = pub
    return send(res, 200, view), true
  }
  const sb = path.match(/^\/admin\/schedules\/slots\/([^/]+)\/(block|unblock)$/)
  if (sb) {
    const s = publications.flatMap((p) => p.slots).find((x) => x.publicId === sb[1])
    Object.assign(s, sb[2] === 'block' ? { state: 'BLOCKED', blockedReason: q('reason') } : { state: 'AVAILABLE', blockedReason: null })
    return send(res, 204), true
  }
  if (path === '/admin/rooms' && m === 'GET') {
    if (!can('room.read')) return deny()
    return send(res, 200, rooms.filter((r) => r.active && (!q('type') || r.roomType === q('type')))), true
  }
  if (path === '/admin/rooms' && m === 'POST') { const r = { publicId: id('RM'), code: q('code'), name: q('name'), roomType: q('roomType'), capacityNotes: q('capacityNotes'), active: true }; rooms.push(r); return send(res, 201, r), true }
  const rd = path.match(/^\/admin\/rooms\/([^/]+)\/deactivate$/)
  if (rd) {
    const r = rooms.find((x) => x.publicId === rd[1]); r.active = false
    let closed = 0
    publications.forEach((p) => p.slots.forEach((s) => { if (s.room === r.code && s.state === 'AVAILABLE') { s.state = 'BLOCKED'; s.blockedReason = `Room ${r.code} taken out of service`; closed++ } }))
    return send(res, 200, { roomCode: r.code, openSlotsClosed: closed, bookedSlotsToMove: 0 }), true
  }
  if (path === '/admin/availability' && m === 'GET' && can('doctor_availability.read')) {
    const d = q('serviceDate')
    const base = [
      { publicId: 'AV-1', doctorPublicId: 'U-DOC', doctor: 'Ibrahim Bello', startAt: `${d}T00:00:00Z`, endAt: `${d}T23:00:00Z`, available: true, reason: null },
      { publicId: 'AV-3', doctorPublicId: 'U-DOC3', doctor: 'Sule Garba', startAt: `${d}T07:00:00Z`, endAt: `${d}T12:00:00Z`, available: false, reason: 'Annual leave' },
    ]
    return send(res, 200, [...base, ...rota.filter((r) => r.serviceDate === d)]), true
  }
  if (path === '/admin/availability' && m === 'POST') {
    const u = users.find((x) => x.publicId === q('doctorPublicId'))
    rota.push({ publicId: id('AV'), doctorPublicId: q('doctorPublicId'), doctor: u?.fullName ?? 'Doctor', serviceDate: q('serviceDate'), startAt: q('startAt'), endAt: q('endAt'), available: q('available') === 'true', reason: q('reason') })
    return send(res, 201, {}), true
  }
  if (path === '/admin/users' && m === 'GET' && can('user.read') && !me.roles.includes('CENTRAL_ADMINISTRATOR')) return send(res, 200, users), true

  // ---------- centres admin ----------
  if (path === '/admin/centres' && m === 'GET') return send(res, 200, centres.map((c) => ({ publicId: c.publicId, code: c.code, name: c.name, lga: c.lga, status: c.status, suspendReason: c.suspendReason, isActive: c.status === 'ACTIVE', canReceiveReferrals: c.status === 'ACTIVE' }))), true
  if (path === '/admin/centres' && m === 'POST') { centres.push({ publicId: id('C'), code: q('code'), name: q('name'), lga: q('lga'), status: 'SETUP', suspendReason: null, caps: { PHARMACY: false, LABORATORY: false, HIM: false } }); return send(res, 201, {}), true }
  const cs = path.match(/^\/admin\/centres\/([^/]+)\/activate$/)
  if (cs) { const c = centres.find((x) => x.publicId === cs[1]); c.status = q('status'); c.suspendReason = q('status') === 'SUSPENDED' ? q('reason') : null; return send(res, 200, {}), true }
  const cc = path.match(/^\/admin\/centres\/([^/]+)\/capabilities(?:\/([A-Z]+))?$/)
  if (cc) {
    const c = centres.find((x) => x.publicId === cc[1])
    const unlocks = { PHARMACY: 'CENTRE_PHARMACY', LABORATORY: 'CENTRE_LABORATORY', HIM: 'CENTRE_HIM' }
    if (cc[2]) { c.caps[cc[2]] = body.enabled; c[`reason_${cc[2]}`] = body.reason }
    return send(res, 200, cc[2] ? { capability: cc[2], unlocksRole: unlocks[cc[2]], enabled: body.enabled } : Object.entries(c.caps).map(([k, v]) => ({ capability: k, unlocksRole: unlocks[k], enabled: v, enabledAt: v ? at(-1000) : null, enabledBy: v ? 'admin' : null, disableReason: v ? null : c[`reason_${k}`] ?? null }))), true
  }

  // ---------- notifications ----------
  if (path === '/admin/notifications/templates') return send(res, 200, templates), true
  const tp = path.match(/^\/admin\/notifications\/templates\/([A-Z_]+)$/)
  if (tp) { const t = templates.find((x) => x.notificationType === tp[1] && x.channel === q('channel')); Object.assign(t, { subject: q('subject'), body: q('body'), updatedReason: q('reason') }); return send(res, 200, {}), true }
  if (path === '/admin/notifications/broadcast') {
    const recipients = !q('targetRole') && !q('centrePublicId') ? 18412 : 23
    broadcasts.unshift({ subject: q('subject'), target: q('targetRole') || (q('centrePublicId') ? 'ALL_ROLES_AT_CENTRE' : 'EVERYONE'), centre: centres.find((c) => c.publicId === q('centrePublicId'))?.name ?? null, sentBy: me.username, sentAt: new Date().toISOString(), recipients, reason: q('reason') })
    return send(res, 200, { recipients }), true
  }
  if (path === '/admin/notifications/broadcasts') return send(res, 200, broadcasts), true

  // ---------- finance ----------
  if (path.startsWith('/finance')) {
    if (path === '/finance/report') return send(res, 200, { collectedFromProvider: 184000, settledFromPatientCredit: 12000, paymentsPending: p2.payments.filter((x) => x.status === 'PENDING').length, paymentsFailed: 3, amountMismatches: 1, unresolvedExceptions: exceptions.length, centreWalletBalanceTotal: Object.values(wallets).reduce((s, w) => s + w.balance, 0) }), true
    if (path === '/finance/wallets') return send(res, 200, centres.map((c) => ({ centre: c.name, centrePublicId: c.publicId, balance: wallets[c.publicId]?.balance ?? 0, canCoverNextBooking: (wallets[c.publicId]?.balance ?? 0) >= 5000 }))), true
    if (path === '/finance/wallets/alerts') return send(res, 200, centres.filter((c) => (wallets[c.publicId]?.balance ?? 0) < 10000).map((c) => ({ centre: c.name, level: 'CRITICAL', balance: wallets[c.publicId]?.balance ?? 0, threshold: 10000, raisedAt: at(-30) }))), true
    const lg = path.match(/^\/finance\/wallets\/([^/]+)\/(ledger|credit)$/)
    if (lg) {
      const w = (wallets[lg[1]] ??= { balance: 0, ledger: [] })
      if (lg[2] === 'ledger') return send(res, 200, [...w.ledger].reverse()), true
      if (!can('wallet.credit')) return deny()
      const ref = (q('reference') || '').trim()
      if (!ref) return err(res, 400, 'Give the funding instrument reference.'), true
      const prior = w.ledger.find((l) => l.reference === ref)
      if (prior) return send(res, 200, { centre: lg[1], amount: prior.amount, balance: w.balance, reference: ref, replayed: true }), true
      const amount = Number(q('amount'))
      w.balance += amount
      w.ledger.push({ reference: ref, direction: 'CREDIT', amount, balanceAfter: w.balance, description: q('description'), source: 'FINANCE', at: new Date().toISOString() })
      return send(res, 200, { centre: lg[1], amount, balance: w.balance, reference: ref, replayed: false }), true
    }
    if (path === '/finance/payments') return send(res, 200, [...p2.payments.map((x) => ({ ...x, reportedAmount: null })), { reference: 'FNPH-77', rrr: '280001111111', status: 'SUCCESS', amount: 10000, creditApplied: 0, amountMismatch: true, reportedAmount: 12000, verifiedAt: at(-700) }]), true
    if (path === '/finance/reconciliation/run') return send(res, 200, { publicId: id('RUN'), checked: 42, matched: 41, exceptions: 1 }), true
    if (path === '/finance/exceptions') return send(res, 200, exceptions), true
    const ex = path.match(/^\/finance\/exceptions\/([^/]+)\/resolve$/)
    if (ex) { if (!q('notes')) return err(res, 400, 'Notes are required.'), true; exceptions.splice(exceptions.findIndex((e) => e.publicId === ex[1]), 1); return send(res, 204), true }
    const rf = path.match(/^\/finance\/payments\/([^/]+)\/refund$/)
    if (rf) return send(res, 200, { reference: rf[1], status: 'REFUNDED' }), true
    const rp = path.match(/^\/finance\/reports\/(\w+)$/)
    if (rp) return send(res, 200, { name: `${rp[1]}_report`, periodStart: at(-43200), periodEnd: at(0), filters: {}, generatedAt: new Date().toISOString(), freshness: 'live', rowCount: 2, rows: [{ date: watDay(-1), payments: 12, collected: 104000 }, { date: watDay(0), payments: 8, collected: 80000 }] }), true
  }

  // ---------- ICT ----------
  if (path === '/admin/ehr-imports' && m === 'GET') return can('ehr_import.read') ? (send(res, 200, imports), true) : deny()
  if (path === '/admin/ehr-imports/active') { const a = imports.find((i) => i.status === 'ACTIVE'); return a ? send(res, 200, a) : err(res, 404, 'No import is active'), true }
  if (path === '/admin/ehr-imports' && m === 'POST') {
    if (!can('ehr_import.upload')) return deny()
    const now = new Date().toISOString()
    const i = { publicId: id('IMP'), fileName: 'uploaded-export.csv', status: 'ACTIVE', sourceAsAt: q('sourceAsAt'), ageInDays: 3, rowCount: 18300, validRowCount: 18296, rejectedRowCount: 4, validationReport: 'Row 17: invalid date of birth', driftDetectedCount: 12, uploadedBy: me.username, uploadedAt: now, activatedAt: now, activatedBy: me.username }
    imports.forEach((previous) => { if (previous.status === 'ACTIVE') previous.status = 'SUPERSEDED' })
    imports.unshift(i)
    return send(res, 200, i), true
  }
  const ia = path.match(/^\/admin\/ehr-imports\/([^/]+)\/activate$/)
  if (ia) {
    if (!can('ehr_import.activate')) return deny()
    imports.forEach((i) => { if (i.status === 'ACTIVE') i.status = 'SUPERSEDED' })
    const i = imports.find((x) => x.publicId === ia[1]); Object.assign(i, { status: 'ACTIVE', activatedAt: new Date().toISOString(), activatedBy: me.username })
    return send(res, 200, i), true
  }
  if (path === '/admin/ehr-records/manual' && m === 'GET') return can('ehr_import.read') ? (send(res, 200, manualEhrRecords), true) : deny()
  if (path === '/admin/ehr-records/manual' && m === 'POST') {
    if (!can('ehr_import.upload')) return deny()
    const row = { publicId: id('MEHR'), version: 0, ...body, syncStatus: 'MANUAL_ONLY', updatedAt: new Date().toISOString(), updatedBy: me.username }
    delete row.reason
    manualEhrRecords.unshift(row)
    return send(res, 201, row), true
  }
  const mer = path.match(/^\/admin\/ehr-records\/manual\/([^/]+)$/)
  if (mer && m === 'PUT') {
    if (!can('ehr_import.upload')) return deny()
    const row = manualEhrRecords.find((x) => x.publicId === mer[1])
    Object.assign(row, body, { version: row.version + 1, syncStatus: 'DIFFERENT', updatedAt: new Date().toISOString(), updatedBy: me.username })
    delete row.reason
    return send(res, 200, row), true
  }
  const mes = path.match(/^\/admin\/ehr-records\/manual\/([^/]+)\/sync$/)
  if (mes && m === 'POST') {
    if (!can('ehr_import.activate')) return deny()
    const row = manualEhrRecords.find((x) => x.publicId === mes[1])
    Object.assign(row, { version: row.version + 1, syncStatus: 'MATCHED', lastSyncedAt: new Date().toISOString(), lastSyncedBy: me.username, lastSyncDirection: body.direction, updatedAt: new Date().toISOString(), updatedBy: me.username })
    return send(res, 200, row), true
  }
  if (path === '/admin/verification-requests') { const st = q('status'); const rows = verifications.filter((v) => !st || v.status === st); return send(res, 200, { content: rows, totalElements: rows.length, totalPages: 1, number: 0, size: 50 }), true }
  const vr = path.match(/^\/admin\/verification-requests\/([^/]+)\/(assign|resolve)$/)
  if (vr) { const v = verifications.find((x) => x.publicId === vr[1]); v.status = vr[2] === 'assign' ? q('status') : q('outcome'); return send(res, 204), true }
  if (path === '/admin/uploads/quarantined') return send(res, 200, [{ publicId: 'UP-9', originalFileName: 'lab-result.pdf.exe', uploadedBy: 'centre', uploadedAt: at(-50), scanResult: 'Executable content detected' }]), true

  // ---------- support ----------
  if (path === '/support/tickets' && m === 'POST') {
    const t = { publicId: id('TK'), ticketNumber: `SUP-${seq}`, category: body.category, priority: body.category === 'CLINICAL_CONCERN' ? 'URGENT' : 'NORMAL', status: 'OPEN', subject: body.subject, escalatedToRole: null, firstResponseMinutes: null, resolutionSummary: null, createdAt: new Date().toISOString(), raisedBy: me.publicId, messages: [{ author: me.displayName, body: body.body, internal: false, sentAt: new Date().toISOString() }] }
    tickets.push(t)
    return send(res, 201, ticketView(t)), true
  }
  if (path === '/support/tickets/mine') return send(res, 200, tickets.filter((t) => t.raisedBy === me.publicId).map((t) => ticketView({ ...t, messages: t.messages.filter((x) => !x.internal) }))), true
  if (path === '/support/queue') return can('ticket.read') ? (send(res, 200, tickets.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status)).map(ticketView)), true) : deny()
  if (path === '/support/breaches') return send(res, 200, tickets.filter((t) => t.priority === 'HIGH' && t.status === 'OPEN').map(ticketView)), true
  const tk = path.match(/^\/support\/tickets\/([^/]+)\/(reply|assign|escalate|resolve)$/)
  if (tk) {
    const t = tickets.find((x) => x.publicId === tk[1])
    if (tk[2] === 'reply') { t.messages.push({ author: me.displayName, body: q('body'), internal: q('internal') === 'true', sentAt: new Date().toISOString() }); if (t.status === 'OPEN') t.status = 'IN_PROGRESS' }
    if (tk[2] === 'assign') t.status = 'IN_PROGRESS'
    if (tk[2] === 'escalate') Object.assign(t, { status: 'ESCALATED', escalatedToRole: q('toRole') })
    if (tk[2] === 'resolve') Object.assign(t, { status: 'RESOLVED', resolutionSummary: q('summary') })
    return send(res, 204), true
  }
  return false
}
