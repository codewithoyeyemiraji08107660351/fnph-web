# FNPH Kaduna Telepsychiatry: web front end

React 19, TypeScript, Vite and Tailwind 4 front end for the three portals in the FNPH Kaduna Telepsychiatry blueprint: the patient portal, the FNPH Core Engine and the Centres of Excellence. It talks to `fnph-telepsychiatric` (Spring Boot) over `/api/v1`.

## Status

**Phase 1, foundation.** Public site with the three entrances, help, document verification and the emergency notice on every public and patient screen (the number comes from the backend, with the last known value kept for offline display). Sign-in with no role selector, authenticator verification or first-time enrolment, and a recovery-code gate. Activation, password reset, forced password change, profile and signed-in devices. The Central Administrator console: overview, users, roles, supervised view, audit log with chain verification, and governed configuration. Idle sign-out matching the server timeout.

**Phase 2, FNPH patient pathway.**

- Patients: enrolment by EHR number, then a five-step booking flow (consent, safety questions, time, vital signs, payment). A triage stop replaces the flow with the emergency contact and nothing that leads back to booking. The held time counts down, a refresh resumes the hold, and payment shows fee, credit and amount due with the RRR. Appointments with history and a join button once the room opens. Documents readable on screen, a warned single download, and the verification code.
- Hub Coordinator: approvals with rota-filtered doctors, patient-service rooms and the care team; rejection with a reason the patient sees; the release desk, bundle release or block, and review queries.
- Nursing and HIM: one work queue. Nurses verify the patient's readings before completing preparation.
- Doctors: worklist with pre-review vitals, the consultation room (identity confirmation first, session clock, modality changes, early termination with a safety action), and the clinical record: note draft, sign and amend, prescriptions with correction, investigations, follow-up, and explicit "not needed" for each.
- Pharmacy and laboratory: review queue showing the document's items, forward-only submit.

**Phase 3, Centres of Excellence.** Centre overview with counts only, patients, referrals (20-character reason, consent taken and witnessed for every referral, no carry-over), time requests that FNPH decides, consultations with the join window and any reason FNPH returned a request, incoming and treated bundles, the centre room (no clock, no end control), and a plain notice where a centre does not run a service. Hub centre requests with centre rooms only and no nurse, and "return to centre" rather than rejection. Doctors get centre consultations in their worklist, room and record.

**Phase 4, operations.** Scheduling (days built as drafts by default, slots, blocking, withdrawing without cancelling bookings), rooms as capacity, doctor rota, centres and capabilities, notices with an explicit send-to-everyone warning, message templates. Finance: overview, wallets with a required funding reference and replay detection, payments, a refund record that says it moves no money, reconciliation and exceptions, reports. ICT and records: EHR exports (activation absent without permission), enrolment checks, quarantined uploads. Helpdesk queue with internal notes, assignment, escalation and resolution, and "Get help" for every account.

**Records, lifecycle and governance.** Consent texts and safety questions are written, reviewed and published here (placeholder wording cannot be published). Patients can move an appointment, ask to cancel it, attach results, and see their record, last safety check, recommendations and files. The hub sees appointments by day, records non-attendance once an appointment has started, and decides cancellation requests. Records staff search patients, clear export mismatches, create a record from an enrolment check, record the eligibility check and create the online account. Documents can be looked up by issue number, re-rendered when the file failed, given one more download, or withdrawn. Staff preparing a consultation see the files attached to it. Finance sees payments per patient.

Every backend endpoint is called except six, on purpose: the separate download claim (the file request is the claim), the four step-by-step approval calls (one-step approval covers them), and the Remita webhook (server to server).

Supervision is read-only: inside the supervised workspace, controls follow the session's permissions, and a screen that changes records says so instead of redirecting.

## Run it

```bash
cp .env.example .env.local
npm install
npm run dev            # http://localhost:5173, /api proxied to VITE_API_PROXY_TARGET
```

The backend must have `APP_PORTAL_URL=http://localhost:5173` so the links in invitation and reset emails open this app.

### Without the backend

```bash
npm run build
npm run mock           # http://localhost:4173
```

`scripts/mock-api.mjs` and `scripts/mock-phase2.mjs` serve the build and fake the API for UI review only. They are never deployed.

Password `Prototype123456` for every account, authenticator code `123456`:

| Account | Role | Notes |
| --- | --- | --- |
| `admin` | Central Administrator | Enrols an authenticator on first sign-in |
| `hub` | Hub Coordinator | |
| `doctor` | Doctor | Has a consultation starting a few minutes after the mock starts |
| `ruth` | Nurse | |
| `nurse` | Nurse | Must change password first |
| `him` | Health Information Management | |
| `pharm`, `lab` | Pharmacist, Laboratory Technician | |
| `ops` | Central Administrator | Already enrolled; use for Phase 4 admin screens |
| `centre`, `zaria` | Centre Hub Coordinators | Sign in at `/centres`. Two centres, for checking isolation |
| `cpharm` | Centre Pharmacist | Kaduna North runs pharmacy; Zaria does not |
| `finance`, `ict`, `helpdesk` | Finance, ICT Support, Helpdesk | |
| `204815` | Patient | Sign in at `/patients`. Answering Yes to the second safety question stops the booking |

The mock walks the whole pathway: book and pay (the second "check now" confirms), approve, verify vitals, consult, review, release, download once. State resets when the mock restarts. Also try `/activate?token=demo` and `/verify/valid-demo`.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Layout

```
src/
  app/            router and lazily loaded admin pages
  components/     ui primitives and the public and workspace layouts
  features/auth/  sign-in state machine
  lib/api/        HTTP client, DTO types (each names its Java class), endpoint modules
  lib/auth/       auth provider, route guards, role registry
  lib/            time formatting (always WAT), password rules, hooks
  pages/          public, auth, account, admin, workspace
deploy/nginx.conf production reverse proxy and security headers
```

## Security decisions

- The access token lives in memory only. The refresh token sits in `sessionStorage`, scoped to the tab, because the API returns it in the response body. Moving it to an httpOnly cookie is on the Phase 4 hardening list and needs a backend change.
- Refreshes are single-flight. The backend revokes the whole sign-in if a refresh token is reused, so parallel refreshes would sign people out.
- The app loads no third-party script or font. Fonts are bundled.
- Route guards only shape the interface. The API enforces every permission and centre boundary.
- The Central Administrator reaches another role's workspace only through an open supervised session, and the `X-View-As-Session` header is sent only while one is open.
- All times display in West Africa Time, whatever the device clock says.
- After sign-in, only known dashboard paths are followed, so a crafted value cannot redirect out of the app.

## Production

Build with `npm run build`, copy `dist/` to the server and use `deploy/nginx.conf`. Serving the app and `/api` from one origin avoids CORS entirely. Leave `VITE_API_BASE_URL` empty for that layout.
