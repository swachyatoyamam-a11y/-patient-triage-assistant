# API Reference

Base URL: `{API_BASE_URL}/api` (local dev: `http://localhost:4000/api`)

All authenticated routes require `Authorization: Bearer <token>`, where the
token comes from `POST /auth/login` or `POST /auth/register`.

Every error response has the shape:
```json
{ "error": { "message": "string", "details": "optional, e.g. Zod field errors" } }
```

---

## Auth

### `POST /auth/register`
Public for `role: PATIENT` (the default). Rate-limited (10 requests / 15 min).
Requesting `role: NURSE | DOCTOR | ADMIN` additionally requires an
`Authorization: Bearer <token>` for an existing `ADMIN` — this endpoint is
how admins provision staff accounts, not a public way to self-elevate.

```json
// Request
{
  "email": "patient@example.com",
  "password": "at least 8 characters",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "PATIENT",           // PATIENT | NURSE | DOCTOR | ADMIN, default PATIENT
  "dateOfBirth": "1990-01-01", // required if role=PATIENT
  "sex": "Female"               // required if role=PATIENT
}
```
`201` → `{ "user": {...}, "token": "jwt" }` (no `passwordHash` ever included)
`401` if a privileged role is requested with no/invalid admin token · `403`
if the caller is authenticated but not an `ADMIN` · `409` if email already
registered · `400` if patient fields missing

### `POST /auth/signup`
Public. Rate-limited. Patient-only self-registration — `role` is not a
client-supplied field here, it's always `PATIENT` server-side. Prefer this
over `/auth/register` for a public sign-up UI.

### `POST /auth/login`
Public. Rate-limited.
```json
{ "email": "patient@example.com", "password": "..." }
```
`200` → `{ "user": {...}, "token": "jwt" }` · `401` on bad credentials

### `GET /auth/me`
Authenticated. Returns the current user, including `patientProfile` /
`doctorProfile` if applicable.

---

## Patients

### `GET /patients/me`
Role: `PATIENT`. Returns the patient's own profile.

### `GET /patients/me/history`
Role: `PATIENT`. Returns `{ medicalHistory: [...], assessments: [...] }`,
most recent assessment first, each including its `recommendation` if one
exists.

---

## Assessments

### `POST /assessments`
Role: `PATIENT`. Creates an assessment and **synchronously runs the rule
engine, then (if not short-circuited) the AI layer**, before responding —
so this call's latency includes at least one rule-engine pass and possibly
one AI round trip.

```json
{
  "age": 34,
  "sex": "Female",
  "primarySymptom": "chest pain",
  "painLevel": 7,
  "durationHours": 3,
  "temperatureCelsius": 37.8,
  "additionalSymptoms": ["sweating", "nausea"],
  "medicalHistory": ["asthma"],
  "currentMedications": ["albuterol"],
  "isPregnant": false,
  "lifestyleFactors": ["smoker"]
}
```
`201` →
```json
{
  "assessment": { "urgencyLevel": "EMERGENCY", "recommendation": {} },
  "analysisFailed": false,
  "notice": "This is not a medical diagnosis. Please consult a qualified healthcare professional."
}
```
If `analysisFailed` is `true`, the intake was still saved successfully —
only the automated analysis step failed. Staff can retry it via
`POST /assessments/:id/reanalyze`.

### `GET /assessments`
Role: `NURSE | DOCTOR | ADMIN`. The live clinical queue, sorted by urgency
(EMERGENCY first). Query params: `status`, `urgency`, `limit` (default 50,
max 100), `cursor` (for pagination).

### `GET /assessments/:id`
Authenticated. Full assessment detail including symptoms, recommendation,
and every matched rule trigger.

### `PATCH /assessments/:id`
Role: `NURSE | DOCTOR | ADMIN`.
```json
{ "status": "REVIEWED", "clinicianNotes": "Discussed with patient, advised rest." }
```
Setting `status: "REVIEWED"` automatically stamps `reviewedById` /
`reviewedAt` on the assessment.

### `POST /assessments/:id/reanalyze`
Role: `NURSE | DOCTOR | ADMIN`. Re-runs the rule engine (always) and, if
not short-circuited, the AI layer, exactly like assessment creation does.
Use this if `analysisFailed` was `true` on creation, or to get a fresh AI
opinion after new information comes in.

---

## Appointments

### `POST /appointments`
Role: `PATIENT`.
```json
{ "doctorId": "optional", "scheduledAt": "2026-08-01T14:00:00Z", "reason": "Follow-up" }
```

### `GET /appointments/me`
Role: `PATIENT`. All of the caller's appointments, soonest first.

### `PATCH /appointments/:id`
Role: `NURSE | DOCTOR | ADMIN`.
```json
{ "status": "CONFIRMED" }
```

---

## Reports

### `GET /reports/:id`
Authenticated. Streams a PDF (`Content-Type: application/pdf`) containing
patient details, symptoms, the AI/rule recommendation and reasoning, and
the required non-diagnosis disclaimer. Logs a `REPORT_DOWNLOADED` audit
entry.

---

## Admin

### `GET /admin/users`
Role: `ADMIN`. Up to 100 most recent users. Never includes `passwordHash`.

### `PATCH /admin/users/:id/deactivate`
Role: `ADMIN`. Sets `isActive: false` — deactivated users can no longer log in.

### `GET /admin/rules`
Role: `ADMIN`. All rules, most recently created first.

### `GET /admin/rules/tags`
Role: `ADMIN`. The fixed list of symptom tags the rule engine recognizes —
use this to populate a picker rather than free-text tag entry.

### `POST /admin/rules`
Role: `ADMIN`.
```json
{
  "name": "Severe abdominal pain",
  "description": "...",
  "condition": { "allOf": ["severe_abdominal_pain"] },
  "resultingUrgency": "URGENT",
  "isActive": true
}
```
`400` if the condition references a tag not in the known-tags list, or if
the condition is empty (would match every assessment).

### `PATCH /admin/rules/:id` / `DELETE /admin/rules/:id`
Role: `ADMIN`.

### `GET /admin/audit-logs`
Role: `ADMIN`. Query params: `action`, `limit` (default 50).

---

## Analytics

### `GET /analytics/summary`
Role: `ADMIN | DOCTOR | NURSE`.
```json
{
  "patientsToday": 42,
  "emergencyCases": 3,
  "urgencyBreakdown": [{ "urgencyLevel": "EMERGENCY", "_count": 3 }],
  "averageWaitMinutes": 18.4
}
```

### `GET /analytics/common-symptoms`
Role: `ADMIN | DOCTOR | NURSE`. Top 10 most frequently reported discrete
symptoms.

---

## Health

### `GET /health/live`
Public. Process liveness — no dependencies checked. `200` always if the
process is up.

### `GET /health/ready`
Public. Also checks database connectivity. `200` if reachable, `503` if not.
Use `/live` for a load balancer's liveness probe and `/ready` for its
readiness probe — they answer different questions.
