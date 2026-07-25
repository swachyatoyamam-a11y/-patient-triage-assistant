# Future Improvements

An honest backlog, organized by urgency. Items already flagged inline in
code comments or package READMEs are cross-referenced here rather than
repeated in full.

## Should happen before real patients use this

1. **Replace the interim JWT-cookie auth with real Clerk integration**, or
   at minimum make the session cookie httpOnly and server-issued. See
   `frontend/README.md`'s auth architecture section and
   `docs/deployment/compliance.md` item 1 — this is the single highest-
   priority item in this whole list.
2. **Clinical safety review of the rule engine's seeded rules and the AI
   prompt**, by an actual licensed clinician. See `docs/deployment/compliance.md`.
3. **Expand symptom-tag keyword coverage** based on real intake phrasing,
   or replace substring matching with something more robust. Currently
   documented (and tested — see `backend/tests/unit/symptom-tags.test.ts`)
   as missing real paraphrases. This is the rule engine's biggest weak
   point and the first thing to harden with real usage data.
4. **BAAs with every vendor before any real key is set** — see the vendor
   table in `docs/deployment/compliance.md`.
5. **Data retention/deletion policy and job** — nothing currently deletes
   old assessment data.

## Product features named in the spec but not yet built

- **Notification delivery** — `Notification` model exists, nothing sends
  email or SMS yet. `nodemailer` is a backend dependency but unused.
  Twilio-style SMS is entirely unwired.
- **Admin settings page** — currently an honest placeholder
  (`frontend/src/app/admin/settings/page.tsx`) rather than a working
  feature. Org-level config (notification templates, department routing
  strings, data retention settings) has no UI yet.
- **Doctor accounts and doctor-specific views** — the `Doctor` model and
  `doctorId` on appointments exist, and `DOCTOR` is a full role in the
  RBAC system, but there's no doctor-specific dashboard distinct from the
  general clinical portal nurses also use.

## Engineering quality-of-life

- **CI pipeline** — no CI config exists. Wiring `npm test` (both packages)
  to run on every push/PR is the most valuable single addition here.
- **Testcontainers-backed integration tests** — current backend tests all
  mock Prisma; nothing exercises real SQL against a real (even if
  ephemeral) Postgres instance. Worth adding before this scales past a
  single reviewer's manual QA.
- **Websocket/SSE push for the clinical queue** instead of 20-second
  polling (`frontend/src/app/clinical/dashboard/page.tsx`) — polling was
  the pragmatic choice for this build, not the final answer.
- **Log aggregation** — `winston` logs to stdout only right now; needs a
  real transport (Datadog/CloudWatch/etc) before production.
- **Structured secrets management** beyond platform env vars.
- **View-access audit logging** — currently only writes are audited (see
  `docs/deployment/compliance.md`); consider whether clinicians simply
  *viewing* a patient record needs the same trail.

## Design/UX

- The rule-builder UI (`/admin/rules`) only supports `allOf` conditions
  through the form — `anyOf`, `noneOf`, and age bounds exist in the
  backend DSL and are exercised by tests, but aren't exposed in this UI
  yet. An admin who needs those currently has to call the API directly.
- No bulk actions anywhere (e.g., reviewing multiple low-urgency
  assessments at once).
