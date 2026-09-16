// Development-only. The FNPH pathway as a small in-memory state machine, so the
// Phase 2 screens can be exercised end to end without the Spring Boot stack.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const at = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString()
const watDay = (offsetDays) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date(Date.now() + offsetDays * 86_400_000))
let seq = 100
const id = (prefix) => `${prefix}-${++seq}`

export const PATIENTS = {
  'P-1': { name: 'Fatima Sani', ehr: '204815' },
  'P-2': { name: 'Yakubu Ali', ehr: '198304' },
}

export const state = {
  consentVersion: '2026.1',
  consented: false,
  triage: [],
  takenOnce: false,
  appointments: [
    {
      publicId: 'A-LIVE', reference: 'APT-LIVE01', status: 'APPROVED', patientId: 'P-1',
      appointmentDate: at(5), scheduledEndAt: at(35), heldUntil: null, room: 'Consultation Room 2',
      doctor: 'U-DOC', nurse: 'U-NUR2', him: 'U-HIM', pharmacist: 'U-PH', lab: 'U-LAB',
      nursing: 'UNTREATED', himState: 'UNTREATED', exception: null, himException: null,
    },
    {
      publicId: 'A-WAIT', reference: 'APT-WAIT02', status: 'AWAITING_APPROVAL', patientId: 'P-2',
      appointmentDate: `${watDay(1)}T09:00:00Z`, scheduledEndAt: `${watDay(1)}T09:30:00Z`, heldUntil: null, room: null,
      nursing: 'UNTREATED', himState: 'UNTREATED',
    },
    {
      publicId: 'A-DONE', reference: 'APT-DONE03', status: 'COMPLETED', patientId: 'P-1',
      appointmentDate: at(-60 * 26), scheduledEndAt: at(-60 * 26 + 30), room: 'Consultation Room 1',
      doctor: 'U-DOC', nurse: 'U-NUR2', him: 'U-HIM', pharmacist: 'U-PH', nursing: 'TREATED', himState: 'TREATED',
    },
  ],
  vitals: {
    'A-LIVE': [{ publicId: 'V-1', systolic: 128, diastolic: 82, heartRate: 76, temperature: 36.8, weightKg: 68, heightCm: 165, bmi: 25.0, measuredAt: at(-90), measurementSource: 'Home blood pressure machine', notes: 'Slept badly this week' }],
  },
  payments: [],
  consultations: {
    'C-DONE': { publicId: 'C-DONE', appointment: 'A-DONE', identityConfirmed: true, modality: 'VIDEO', doctorJoinedAt: at(-60 * 26), patientJoinedAt: at(-60 * 26 + 1), endedAt: at(-60 * 26 + 30), outcome: 'COMPLETED' },
  },
  notes: {
    'C-DONE': [{ publicId: 'N-1', version: 1, clinicalNote: 'Mood improved on current dose. Sleep still poor. Continue sertraline.', signedAt: at(-60 * 25), signedBy: 'doctor', supersededAt: null }],
  },
  bundles: {
    'B-DONE': {
      publicId: 'B-DONE', consultation: 'C-DONE', appointment: 'A-DONE', status: 'INCOMPLETE', blockedReason: null, createdAt: at(-60 * 25), releasedAt: null, releasedBy: null,
      components: { CLINICAL_NOTE: { complete: true }, PRESCRIPTION: { complete: false }, INVESTIGATION: { notRequired: true, reason: 'No investigations indicated at this review.' }, FOLLOW_UP: { complete: true } },
      prescriptions: ['PR-1'], investigations: [], followUps: [{ publicId: 'F-1', recommendation: 'Review in six weeks.', reviewInterval: '6 weeks' }],
    },
  },
  prescriptions: {
    'PR-1': { publicId: 'PR-1', issueNumber: 'RX-2609-K7M4NPQR', status: 'PENDING_REVIEW', issueDate: watDay(-1), expiryDate: watDay(6), clinicalInformation: 'Depressive episode, established on sertraline. No known allergies.', items: [{ medication: 'Sertraline', strength: '100 mg', frequency: 'Once daily, morning', duration: '28 days', instructions: 'Take with food' }], bundle: 'B-DONE', patientId: 'P-1' },
  },
  investigations: {},
  reviews: [{ publicId: 'R-1', reviewType: 'PHARMACY', assignedAt: at(-60 * 25), openedAt: null, submittedAt: null, queryRaised: false, queryDetail: null, documentType: 'PRESCRIPTION', issueNumber: 'RX-2609-K7M4NPQR', documentPublicId: 'PR-1', reviewer: 'U-PH' }],
  documents: [],
}

const appt = (publicId) => state.appointments.find((a) => a.publicId === publicId)
const view = (a) => ({
  publicId: a.publicId, reference: a.reference, status: a.status, appointmentDate: a.appointmentDate, scheduledEndAt: a.scheduledEndAt,
  heldUntil: a.heldUntil ?? null, room: a.room ?? null,
  joinWindowOpensAt: ['APPROVED', 'IN_PROGRESS'].includes(a.status) ? new Date(new Date(a.appointmentDate).getTime() - 15 * 60_000).toISOString() : null,
  rejectedReason: a.rejectedReason ?? null,
})
const bundleView = (b) => ({
  publicId: b.publicId, status: b.status, blockedReason: b.blockedReason, releasedBy: b.releasedBy, releasedAt: b.releasedAt,
  components: Object.entries(b.components).map(([type, c]) => ({ componentType: type, complete: !!c.complete, notRequired: !!c.notRequired, notRequiredReason: c.reason ?? null, outstanding: !(c.complete || c.notRequired) })),
})
const settle = (b) => {
  if (b.status === 'RELEASED') return
  const ready = Object.values(b.components).every((c) => c.complete || c.notRequired)
  if (b.status !== 'BLOCKED') b.status = ready ? 'READY' : 'INCOMPLETE'
}
const bundleFor = (consultationId) => Object.values(state.bundles).find((b) => b.consultation === consultationId)
const ensureBundle = (consultationId) => {
  let b = bundleFor(consultationId)
  if (!b) {
    const c = state.consultations[consultationId]
    b = { publicId: id('B'), consultation: consultationId, appointment: c.appointment, status: 'INCOMPLETE', blockedReason: null, createdAt: new Date().toISOString(), releasedAt: null, releasedBy: null, components: { CLINICAL_NOTE: {}, PRESCRIPTION: {}, INVESTIGATION: {}, FOLLOW_UP: {} }, prescriptions: [], investigations: [], followUps: [] }
    state.bundles[b.publicId] = b
  }
  return b
}

const QR = readFileSync(resolve(process.cwd(), 'public/favicon-64.png'))
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')

export const MOCK_ROOM_HTML = '<!doctype html><title>Mock room</title><body style="margin:0;display:grid;place-items:center;height:100vh;background:#17231f;color:#dff2e9;font:16px system-ui">Video room (mock). Token received.</body>'

/** Returns true when handled. */
export function handlePhase2({ req, res, url, path, m, me, body, send, err }) {
  const can = (p) => me.permissions.includes(p)
  const deny = () => err(res, 403, 'Your account does not have access to this.')
  const patientId = me.patientId

  // ---------------- Patient pathway ----------------
  if (path === '/consent/current' && m === 'GET') {
    if (!can('consent.read') && !can('consent.accept')) return deny(), true
    return send(res, 200, { version: state.consentVersion, title: 'Consent to telepsychiatry', body: 'FNPH Kaduna provides follow-up consultations by secure video to existing patients.\n\nThe service is not for emergencies. Consultations last 30 minutes and are not recorded. Your information is seen only by the staff involved in your care.\n\nYou can stop at any time.' }), true
  }
  if (path === '/consent/accept') { state.consented = true; return send(res, 201, { publicId: id('CA'), version: state.consentVersion, acceptedAt: new Date().toISOString() }), true }
  if (path === '/triage/questions') {
    return send(res, 200, { version: 'T1', questions: [
      { publicId: 'Q1', sequence: 1, questionText: 'Are you in a private place where you can talk freely?' },
      { publicId: 'Q2', sequence: 2, questionText: 'Are you thinking about harming yourself or someone else right now?' },
      { publicId: 'Q3', sequence: 3, questionText: 'Do you have a working phone or computer with a camera?' },
    ] }), true
  }
  if (path === '/triage/responses') {
    const stopped = body.Q2 === 'YES' || body.Q1 === 'NO'
    const r = { publicId: id('TR'), outcome: stopped ? 'STOPPED' : 'PROCEED', mayProceed: !stopped, stopReason: stopped ? (body.Q2 === 'YES' ? 'Current risk of harm' : 'No private space') : null, escalation: stopped ? 'This service cannot help with what you have described, and it is not for emergencies.\n\nPlease call the clinical emergency line now, or go to the nearest hospital emergency department.' : null }
    state.triage.unshift(r)
    return send(res, 201, r), true
  }
  if (path === '/booking/times') {
    const date = url.searchParams.get('date')
    const hours = date === watDay(0) ? [15, 16] : [8, 8.5, 9, 10, 11, 13]
    return send(res, 200, hours.map((h, i) => {
      const hh = String(Math.floor(h)).padStart(2, '0')
      const mm = h % 1 ? '30' : '00'
      const endH = h % 1 ? String(Math.floor(h) + 1).padStart(2, '0') : hh
      const endM = h % 1 ? '00' : '30'
      return { startAt: `${date}T${hh}:${mm}:00Z`, endAt: `${date}T${endH}:${endM}:00Z`, slotPublicId: i === 0 ? `S-FIRST-${date}` : `S-${date}-${i}`, remaining: i === 1 ? 1 : 3 }
    })), true
  }
  if (path === '/booking/hold') {
    const last = state.triage[0]
    if (!state.consented) return err(res, 409, 'Accept the current consent before choosing a time.'), true
    if (!last || last.outcome !== 'PROCEED') return err(res, 409, 'Answer the safety questions before choosing a time.'), true
    if (body.slotPublicId.startsWith('S-FIRST') && !state.takenOnce) { state.takenOnce = true; return err(res, 409, 'Someone just took that time. Please choose another.'), true }
    const [, date, idx] = body.slotPublicId.match(/^S-(\d{4}-\d{2}-\d{2})-(\d+)$/) ?? []
    const start = date ? new Date(`${date}T${String(8 + Number(idx)).padStart(2, '0')}:00:00Z`) : new Date(Date.now() + 86_400_000)
    const a = { publicId: id('A'), reference: `APT-${seq}`, status: 'SLOT_HELD', patientId: 'P-1', appointmentDate: start.toISOString(), scheduledEndAt: new Date(start.getTime() + 30 * 60_000).toISOString(), heldUntil: at(Number(process.env.MOCK_HOLD_MINUTES || 10)), room: null, nursing: 'UNTREATED', himState: 'UNTREATED' }
    state.appointments.push(a)
    return send(res, 201, view(a)), true
  }
  if (path === '/booking/mine') {
    for (const a of state.appointments) if (a.status === 'SLOT_HELD' && new Date(a.heldUntil) < new Date()) a.status = 'EXPIRED'
    return send(res, 200, state.appointments.filter((a) => a.patientId === patientId).map(view)), true
  }
  const hist = path.match(/^\/(booking|hub\/approvals)\/([^/]+)\/history$/)
  if (hist) {
    return send(res, 200, [
      { fromStatus: null, toStatus: 'SLOT_HELD', changedBy: '204815', changedAt: at(-120), reason: 'Slot held for 10 minutes while payment completes' },
      { fromStatus: 'SLOT_HELD', toStatus: 'AWAITING_APPROVAL', changedBy: 'system', changedAt: at(-115), reason: 'Payment FNPH-ABC confirmed' },
    ]), true
  }
  if (path.startsWith('/clinical/vitals/appointments/') && m === 'POST') {
    const a = appt(path.split('/')[4])
    if (!a || a.patientId !== patientId) return err(res, 409, 'No such appointment'), true
    if (body.systolic && body.diastolic && body.diastolic >= body.systolic) return err(res, 409, 'Diastolic pressure cannot be at or above systolic. Check the two values have not been swapped.'), true
    const v = { publicId: id('V'), ...body, bmi: body.weightKg && body.heightCm ? +(body.weightKg / (body.heightCm / 100) ** 2).toFixed(1) : null, measuredAt: body.measuredAt ?? new Date().toISOString() }
    ;(state.vitals[a.publicId] ??= []).unshift(v)
    return send(res, 201, v), true
  }
  if (path === '/payments/credit') return send(res, 200, { balance: 2000, currency: 'NGN', entries: [] }), true
  if (path === '/payments/mine') return send(res, 200, state.payments), true
  if (path === '/payments/initiate') {
    const existing = state.payments.find((p) => !p.usedForBooking && (p.status === 'PENDING' || p.status === 'SUCCESS'))
    if (existing) return send(res, 200, existing), true
    const p = { publicId: id('PAY'), reference: `FNPH-${seq}`, rrr: '280007123456', status: 'PENDING', amount: 10000, creditApplied: 2000, payableAmount: 8000, currency: 'NGN', initiatedAt: new Date().toISOString(), verifiedAt: null, expiresAt: at(48 * 60), failureReason: null, amountMismatch: false, usedForBooking: false, checks: 0 }
    state.payments.unshift(p)
    return send(res, 200, p), true
  }
  const verify = path.match(/^\/payments\/([^/]+)\/verify$/)
  if (verify) {
    const p = state.payments.find((x) => x.reference === decodeURIComponent(verify[1]))
    if (!p) return err(res, 409, 'No payment with that reference'), true
    p.checks += 1
    if (p.checks >= 2 && p.status === 'PENDING') {
      p.status = 'SUCCESS'
      p.verifiedAt = new Date().toISOString()
      const held = state.appointments.find((a) => a.patientId === 'P-1' && a.status === 'SLOT_HELD')
      if (held) { held.status = 'AWAITING_APPROVAL'; held.heldUntil = null; p.usedForBooking = true }
    }
    return send(res, 200, p), true
  }
  if (path === '/documents/mine') return send(res, 200, state.documents), true
  const file = path.match(/^\/documents\/([^/]+)\/(file|qr)$/)
  if (file) {
    const d = state.documents.find((x) => x.publicId === file[1])
    if (!d) return err(res, 409, 'No such document'), true
    if (file[2] === 'qr') { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(QR); return true }
    if (d.downloadCount >= d.maxDownloads) return err(res, 409, `You have already downloaded this document. You can still read it on screen until it expires on ${d.expiresAt.slice(0, 10)}.`), true
    d.downloadCount += 1
    d.viewOnly = true
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${d.issueNumber}.pdf"` })
    res.end(PDF)
    return true
  }
  if (path === '/clinical/prescriptions/mine') return send(res, 200, Object.values(state.prescriptions).filter((p) => p.patientId === patientId && p.status === 'RELEASED')), true
  if (path === '/clinical/investigations/mine') return send(res, 200, []), true

  const join = path.match(/^\/consultations\/([^/]+)\/join\/(doctor|patient)$/)
  if (join) {
    const a = appt(join[1])
    const role = join[2]
    if (!a || (role === 'patient' ? a.patientId !== patientId : a.doctor !== me.publicId)) return err(res, 409, 'No such appointment'), true
    if (!['APPROVED', 'IN_PROGRESS'].includes(a.status)) return err(res, 409, 'That appointment is not confirmed, so there is nothing to join'), true
    const start = new Date(a.appointmentDate).getTime()
    if (Date.now() < start - 15 * 60_000) return err(res, 409, 'The consultation room opens 15 minutes before your appointment.'), true
    if (role === 'patient' && Date.now() > start + 15 * 60_000) return err(res, 409, 'The join window closed 15 minutes after the start time. Please contact the hospital to rebook.'), true
    let c = Object.values(state.consultations).find((x) => x.appointment === a.publicId)
    if (!c) {
      c = { publicId: `C-${a.publicId}`, appointment: a.publicId, identityConfirmed: false, modality: 'VIDEO', createdCount: 0 }
      state.consultations[c.publicId] = c
    }
    c.createdCount = (c.createdCount ?? 0) + 1
    if (role === 'doctor' && !c.doctorJoinedAt) { c.doctorJoinedAt = new Date().toISOString(); a.status = 'IN_PROGRESS' }
    if (role === 'patient' && !c.patientJoinedAt) c.patientJoinedAt = new Date().toISOString()
    const origin = `http://${req.headers.host}`
    return send(res, 200, { consultationPublicId: c.publicId, roomUrl: `${origin}/mock-room`, token: `tok-${role}-${seq++}`, scheduledStart: a.appointmentDate, scheduledEnd: a.scheduledEndAt, remainingSeconds: 1800, firstWarningMinutes: 5, secondWarningMinutes: 2, isOwner: role === 'doctor' }), true
  }

  // ---------------- In-call and authoring ----------------
  const cons = path.match(/^\/consultations\/([^/]+)\/(identity-confirmed|modality|terminate|quality)$/)
  if (cons) {
    const c = state.consultations[cons[1]]
    if (!c) return err(res, 409, 'No such consultation'), true
    if (cons[2] === 'identity-confirmed') c.identityConfirmed = true
    if (cons[2] === 'modality') c.modality = url.searchParams.get('modality')
    if (cons[2] === 'terminate') {
      if (!body.safetyAction || body.safetyAction.trim().length < 10) return err(res, 400, 'Record what was done to keep the patient safe before ending the session'), true
      c.endedAt = new Date().toISOString(); c.terminationReason = body.reason; c.safetyActionTaken = body.safetyAction; c.outcome = 'TERMINATED'
      appt(c.appointment).status = 'COMPLETED'
    }
    return send(res, 204), true
  }
  const summary = path.match(/^\/clinical\/consultations\/([^/]+)$/)
  if (summary) {
    const c = state.consultations[summary[1]]
    if (!c) return err(res, 404, 'No such consultation'), true
    const a = appt(c.appointment)
    return send(res, 200, { centreName: a.centreName ?? null, patientName: a.centreName ? PATIENTS[a.patientId].name : null, referralReason: a.referralReason ?? null, publicId: c.publicId, scheduledStartAt: a.appointmentDate, scheduledEndAt: a.scheduledEndAt, startedAt: c.doctorJoinedAt, endedAt: c.endedAt ?? null, modality: c.modality, outcome: c.outcome ?? null, identityConfirmed: c.identityConfirmed, doctorJoinedAt: c.doctorJoinedAt ?? null, patientJoinedAt: c.patientJoinedAt ?? null, terminationReason: c.terminationReason ?? null, safetyActionTaken: c.safetyActionTaken ?? null }), true
  }
  const rec = path.match(/^\/clinical\/consultations\/([^/]+)\/(.+)$/)
  if (rec) {
    const cid = rec[1]
    const sub = rec[2]
    if (!state.consultations[cid]) return err(res, 404, 'No such consultation'), true
    const notes = (state.notes[cid] ??= [])
    const current = notes.find((n) => !n.supersededAt)
    if (sub === 'record') {
      const b = bundleFor(cid)
      if (!b) return send(res, 200, { consultationPublicId: cid, bundle: null, components: [], prescriptions: [], investigations: [], followUps: [] }), true
      settle(b)
      return send(res, 200, {
        consultationPublicId: cid, bundle: { publicId: b.publicId, status: b.status },
        components: bundleView(b).components.map((c) => ({ ...c, settled: !c.outstanding })),
        prescriptions: b.prescriptions.map((pid) => { const p = state.prescriptions[pid]; return { publicId: p.publicId, issueNumber: p.issueNumber, status: p.status, itemCount: p.items.length, supersedesAnother: !!p.supersedes } }),
        investigations: b.investigations.map((iid) => { const i = state.investigations[iid]; return { publicId: i.publicId, issueNumber: i.issueNumber, status: i.status, itemCount: i.panels.length, supersedesAnother: false } }),
        followUps: b.followUps,
      }), true
    }
    if (sub === 'note/history') return send(res, 200, notes), true
    if (sub === 'note' && m === 'PUT') {
      if (current?.signedAt) return err(res, 409, 'That note is signed. Amend it instead.'), true
      if (current) current.clinicalNote = body.clinicalNote
      else notes.push({ publicId: id('N'), version: 1, clinicalNote: body.clinicalNote, signedAt: null, signedBy: null, supersededAt: null })
      ensureBundle(cid)
      return send(res, 200, notes.find((n) => !n.supersededAt)), true
    }
    if (sub === 'note/sign') {
      if (!current) return err(res, 409, 'Write the note before signing it'), true
      Object.assign(current, { signedAt: new Date().toISOString(), signedBy: me.username, followUpRecommendation: body.followUpRecommendation ?? null, followUpTimeline: body.followUpTimeline ?? null })
      ensureBundle(cid).components.CLINICAL_NOTE.complete = true
      return send(res, 200, current), true
    }
    if (sub === 'note/amend') {
      if (!body.amendmentReason || body.amendmentReason.length < 10) return err(res, 400, 'Give a reason of at least 10 characters.'), true
      current.supersededAt = new Date().toISOString()
      const next = { publicId: id('N'), version: current.version + 1, clinicalNote: body.clinicalNote, signedAt: new Date().toISOString(), signedBy: me.username, supersededAt: null, amendmentReason: body.amendmentReason }
      notes.push(next)
      return send(res, 200, next), true
    }
    const b = ensureBundle(cid)
    const a = appt(state.consultations[cid].appointment)
    if (sub === 'prescriptions') {
      const pr = { publicId: id('PR'), issueNumber: `RX-${seq}`, status: 'PENDING_REVIEW', issueDate: watDay(0), expiryDate: watDay(7), clinicalInformation: body.clinicalInformation ?? null, items: body.items, bundle: b.publicId, patientId: a.patientId }
      state.prescriptions[pr.publicId] = pr
      b.prescriptions.push(pr.publicId)
      state.reviews.push({ publicId: id('R'), reviewType: 'PHARMACY', assignedAt: new Date().toISOString(), openedAt: null, submittedAt: null, queryRaised: false, queryDetail: null, documentType: 'PRESCRIPTION', issueNumber: pr.issueNumber, documentPublicId: pr.publicId, reviewer: a.pharmacist ?? 'U-PH' })
      return send(res, 201, { publicId: pr.publicId, issueNumber: pr.issueNumber, status: pr.status, issueDate: pr.issueDate, expiryDate: pr.expiryDate, itemCount: pr.items.length }), true
    }
    if (sub === 'investigations') {
      const inv = { publicId: id('IN'), issueNumber: `LAB-${seq}`, status: 'PENDING_REVIEW', issueDate: watDay(0), expiryDate: watDay(30), clinicalInformation: body.clinicalInformation ?? null, panels: body.items, bundle: b.publicId }
      state.investigations[inv.publicId] = inv
      b.investigations.push(inv.publicId)
      return send(res, 201, { publicId: inv.publicId, issueNumber: inv.issueNumber, status: inv.status, issueDate: inv.issueDate, itemCount: inv.panels.length }), true
    }
    if (sub === 'follow-up') { b.followUps.push({ publicId: id('F'), recommendation: body.recommendation, reviewInterval: body.reviewInterval ?? null }); b.components.FOLLOW_UP.complete = true; return send(res, 204), true }
    if (sub === 'not-required') {
      if (!body.reason || body.reason.length < 10) return err(res, 400, 'Give a reason of at least 10 characters.'), true
      b.components[body.component] = { notRequired: true, reason: body.reason }
      return send(res, 204), true
    }
    const sup = sub.match(/^prescriptions\/([^/]+)\/supersede$/)
    if (sup) {
      state.prescriptions[sup[1]].status = 'SUPERSEDED'
      const pr = { publicId: id('PR'), issueNumber: `RX-${seq}`, status: 'PENDING_REVIEW', issueDate: watDay(0), expiryDate: watDay(7), clinicalInformation: body.clinicalInformation ?? null, items: body.items, bundle: b.publicId, patientId: a.patientId, supersedes: sup[1] }
      state.prescriptions[pr.publicId] = pr
      b.prescriptions.push(pr.publicId)
      return send(res, 201, { publicId: pr.publicId, issueNumber: pr.issueNumber, status: pr.status, issueDate: pr.issueDate, itemCount: pr.items.length }), true
    }
  }

  // ---------------- Queues ----------------
  if (path === '/clinical/queues/doctor') {
    if (!can('consultation.read')) return deny(), true
    return send(res, 200, state.appointments.filter((a) => a.doctor === me.publicId && !a.centre).map((a) => ({
      appointmentPublicId: a.publicId, reference: a.reference, status: a.status, appointmentDate: a.appointmentDate, scheduledEndAt: a.scheduledEndAt, room: a.room,
      patientName: PATIENTS[a.patientId].name, ehrNumber: PATIENTS[a.patientId].ehr, nursingState: a.nursing, himState: a.himState,
      vitalsRecorded: (state.vitals[a.publicId] ?? []).length > 0,
      consultationPublicId: Object.values(state.consultations).find((c) => c.appointment === a.publicId)?.publicId ?? null,
    }))), true
  }
  const wq = path.match(/^\/clinical\/queues\/(nursing|him)$/)
  if (wq) {
    const kind = wq[1]
    if (!can(`queue.${kind}`)) return deny(), true
    return send(res, 200, state.appointments.filter((a) => ['APPROVED', 'IN_PROGRESS'].includes(a.status) && (kind === 'nursing' ? a.nurse : a.him) === me.publicId).map((a) => ({
      appointmentPublicId: a.publicId, reference: a.reference, appointmentDate: a.appointmentDate, room: a.room, patientName: PATIENTS[a.patientId].name, ehrNumber: PATIENTS[a.patientId].ehr,
      state: kind === 'nursing' ? a.nursing : a.himState, startedAt: null, completedAt: null, exceptionReason: kind === 'nursing' ? a.exception : a.himException,
      vitalsRecorded: (state.vitals[a.publicId] ?? []).length > 0,
    }))), true
  }
  const qa = path.match(/^\/queues\/(nursing|him)\/([^/]+)\/(start|complete|exception)$/)
  if (qa) {
    const [, kind, aid, action] = qa
    const a = appt(aid)
    const key = kind === 'nursing' ? 'nursing' : 'himState'
    if (action === 'start') a[key] = 'IN_PROGRESS'
    if (action === 'complete') {
      if (kind === 'nursing' && !(state.vitals[aid] ?? []).length) return err(res, 409, 'No vitals are recorded for this appointment. Record them, or raise an exception saying the patient did not submit them.'), true
      a[key] = 'TREATED'
    }
    if (action === 'exception') { a[key] = 'EXCEPTION'; a[kind === 'nursing' ? 'exception' : 'himException'] = url.searchParams.get('reason') }
    return send(res, 200, {}), true
  }
  if (path.startsWith('/clinical/vitals/appointments/') && m === 'GET') {
    if (!can('vitals.read')) return deny(), true
    return send(res, 200, state.vitals[path.split('/')[4]] ?? []), true
  }
  const vv = path.match(/^\/clinical\/vitals\/([^/]+)\/verify$/)
  if (vv) {
    if (!can('vitals.verify')) return deny(), true
    const v = Object.values(state.vitals).flat().find((x) => x.publicId === vv[1])
    Object.assign(v, { verifiedAt: new Date().toISOString(), verifiedBy: me.username })
    return send(res, 200, v), true
  }

  // ---------------- Review ----------------
  const rq = path.match(/^\/reviews\/(pharmacy|laboratory)\/queue$/)
  if (rq) {
    if (!can(`review.${rq[1]}`)) return deny(), true
    return send(res, 200, state.reviews.filter((r) => r.reviewer === me.publicId && !r.submittedAt)), true
  }
  const ro = path.match(/^\/reviews\/([^/]+)\/(open|submit)$/)
  if (ro) {
    const r = state.reviews.find((x) => x.publicId === ro[1])
    if (!r || r.reviewer !== me.publicId) return err(res, 400, 'That review is assigned to another professional'), true
    if (ro[2] === 'open') { r.openedAt ??= new Date().toISOString(); return send(res, 204), true }
    if (r.submittedAt) return err(res, 409, 'That review has already been submitted'), true
    if (body.outcome === 'QUERY_RAISED' && !body.queryDetail) return err(res, 400, 'Describe the concern.'), true
    Object.assign(r, { submittedAt: new Date().toISOString(), queryRaised: body.outcome === 'QUERY_RAISED', queryDetail: body.queryDetail ?? null })
    const p = state.prescriptions[r.documentPublicId]
    if (p) {
      p.status = 'REVIEWED'
      const b = state.bundles[p.bundle]
      if (b && b.prescriptions.every((pid) => ['REVIEWED', 'SUPERSEDED'].includes(state.prescriptions[pid].status))) b.components.PRESCRIPTION.complete = true
      if (b) settle(b)
    }
    return send(res, 204), true
  }
  if (path === '/reviews/queries') return send(res, 200, state.reviews.filter((r) => r.queryRaised)), true
  const pd = path.match(/^\/clinical\/(prescriptions|investigations)\/([^/]+)$/)
  if (pd && pd[2] !== 'mine') {
    if (pd[1] === 'prescriptions') {
      if (!can('prescription.read')) return deny(), true
      return send(res, 200, state.prescriptions[pd[2]]), true
    }
    return send(res, 200, state.investigations[pd[2]]), true
  }

  // ---------------- Hub ----------------
  if (path === '/hub/approvals' && m === 'GET') {
    if (!can('appointment.read')) return deny(), true
    const waiting = state.appointments.filter((a) => a.status === 'AWAITING_APPROVAL' && !a.centre)
    return send(res, 200, { total: waiting.length, appointments: waiting.map(view) }), true
  }
  if (path === '/hub/approvals/assignable-staff') {
    if (!can('appointment.assign_team')) return deny(), true
    return send(res, 200, [
      { publicId: 'U-NUR2', fullName: 'Ruth Adeyemi', roles: ['NURSING'] },
      { publicId: 'U-HIM', fullName: 'Musa Danladi', roles: ['HIM'] },
      { publicId: 'U-PH', fullName: 'Chidi Okafor', roles: ['PHARMACIST'] },
      { publicId: 'U-LAB', fullName: 'Zainab Idris', roles: ['LABORATORY_TECHNICIAN'] },
    ]), true
  }
  if (path === '/admin/rooms' && can('room.read')) {
    return send(res, 200, [{ publicId: 'RM-2', code: 'CR2', name: 'Consultation Room 2', roomType: 'PATIENT_SERVICE' }, { publicId: 'RM-3', code: 'CR3', name: 'Consultation Room 3', roomType: 'PATIENT_SERVICE' }]), true
  }
  if (path === '/admin/availability' && can('doctor_availability.read')) {
    const d = url.searchParams.get('serviceDate')
    return send(res, 200, [
      { publicId: 'AV-1', doctorPublicId: 'U-DOC', doctor: 'Ibrahim Bello', startAt: `${d}T07:00:00Z`, endAt: `${d}T12:00:00Z`, available: true },
      { publicId: 'AV-2', doctorPublicId: 'U-DOC2', doctor: 'Grace Audu', startAt: `${d}T09:15:00Z`, endAt: `${d}T12:00:00Z`, available: true },
      { publicId: 'AV-3', doctorPublicId: 'U-DOC3', doctor: 'Sule Garba', startAt: `${d}T07:00:00Z`, endAt: `${d}T12:00:00Z`, available: false, reason: 'Annual leave' },
    ]), true
  }
  const ap = path.match(/^\/hub\/approvals\/([^/]+)\/(approve|reject)$/)
  if (ap) {
    const a = appt(ap[1])
    if (!a || a.status !== 'AWAITING_APPROVAL') return err(res, 409, 'Only a request awaiting approval can be decided'), true
    if (ap[2] === 'reject') { a.status = 'REJECTED'; a.rejectedReason = url.searchParams.get('reason'); return send(res, 200, view(a)), true }
    Object.assign(a, { status: 'APPROVED', doctor: body.doctorPublicId, room: body.roomPublicId === 'RM-3' ? 'Consultation Room 3' : 'Consultation Room 2', nurse: body.nursePublicId, him: body.himOfficerPublicId, pharmacist: body.pharmacistPublicId, lab: body.laboratoryTechnicianPublicId })
    return send(res, 200, view(a)), true
  }
  if (path === '/hub/releases' && m === 'GET') {
    if (!can('release_bundle.read')) return deny(), true
    const wanted = url.searchParams.get('status')
    return send(res, 200, Object.values(state.bundles).map((b) => (settle(b), b)).filter((b) => b.status !== 'RELEASED' && (!wanted || b.status === wanted)).map((b) => {
      const a = appt(b.appointment)
      return { publicId: b.publicId, status: b.status, blockedReason: b.blockedReason, createdAt: b.createdAt, appointmentPublicId: a.publicId, appointmentReference: a.reference, appointmentDate: a.appointmentDate, patientName: PATIENTS[a.patientId].name, ehrNumber: PATIENTS[a.patientId].ehr, doctorName: 'Ibrahim Bello', outstanding: bundleView(b).components.filter((c) => c.outstanding).map((c) => c.componentType) }
    })), true
  }
  const rel = path.match(/^\/hub\/releases\/([^/]+)(?:\/(release|block))?$/)
  if (rel) {
    const b = state.bundles[rel[1]]
    if (!b) return err(res, 404, 'No such bundle'), true
    settle(b)
    if (rel[2] === 'release') {
      const out = bundleView(b).components.filter((c) => c.outstanding)
      if (out.length) return err(res, 409, `Not ready. Still outstanding: ${out.map((c) => c.componentType).join(', ')}.`), true
      Object.assign(b, { status: 'RELEASED', releasedAt: new Date().toISOString(), releasedBy: me.username, blockedReason: null })
      for (const pid of b.prescriptions) {
        const p = state.prescriptions[pid]
        if (p.status !== 'REVIEWED') continue
        p.status = 'RELEASED'
        state.documents.unshift({ publicId: id('D'), issueNumber: p.issueNumber, documentType: 'PRESCRIPTION', status: 'ACTIVE', issuedAt: new Date().toISOString(), expiresAt: at(7 * 24 * 60), downloadCount: 0, maxDownloads: 1, viewOnly: false, verificationUrl: 'http://localhost:4173/verify/valid-demo', revokedReason: null })
      }
    }
    if (rel[2] === 'block') {
      if (b.status === 'RELEASED') return err(res, 409, 'That bundle has already been released.'), true
      Object.assign(b, { status: 'BLOCKED', blockedReason: url.searchParams.get('reason') })
    }
    return send(res, 200, bundleView(b)), true
  }
  return false
}
