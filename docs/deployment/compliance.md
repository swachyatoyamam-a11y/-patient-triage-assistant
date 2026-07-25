# Compliance Considerations

**This document identifies what a real hospital deployment must address.
It is not legal advice, and completing this checklist does not by itself
make this system HIPAA-compliant or safe to deploy.** Engage actual legal
and compliance counsel, and a clinical safety reviewer, before this
touches real patient data. Nothing below substitutes for that.

## What this codebase does not decide for you

Whether this system requires HIPAA compliance, FDA regulation as a
clinical decision support (CDS) tool, or other regulatory review depends
on how it's deployed and what it's used for — questions this codebase
cannot answer on your behalf. Get a legal/compliance and clinical safety
review before deployment, not after.

## Before any real patient data touches this system

- [ ] **BAA (Business Associate Agreement) with every third-party vendor**
      that will process PHI, including Anthropic and/or OpenAI (whichever
      AI provider is configured — see `backend/src/ai/engine/`), your
      hosting providers (Vercel, Railway/Render, Supabase), and any email/
      SMS provider eventually wired into the `Notification` model. **Do
      not set a real `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` against real
      patient assessments without a signed BAA in place first.**
- [ ] **Clinical safety review** of the rule engine's seeded rules and the
      AI prompt's instructions (`backend/src/ai/prompts/triage-analysis.prompt.ts`)
      by a licensed clinician, not just an engineering review. The
      "over-triage rather than under-triage when uncertain" instruction in
      that prompt is a specific design choice worth that reviewer's
      explicit sign-off, not just an assumption.
- [ ] **Legal review** of whether this specific deployment requires FDA
      clearance as clinical decision support software, and what state-level
      telehealth/triage regulations apply
- [ ] **Data retention policy** — decide and configure how long
      `Assessment`, `Symptom`, `Recommendation`, and `AuditLog` rows are
      kept, and implement the deletion/archival job. Nothing in this
      codebase currently deletes old data.
- [ ] **Encryption at rest** confirmed on the Supabase database (Supabase
      encrypts at rest by default, but confirm this for your specific plan)
      and **encryption in transit** confirmed everywhere (HTTPS on Vercel/
      Railway/Render is default, but verify no HTTP fallback path exists)
- [ ] **Access review process** — who can be granted `ADMIN` or clinical
      roles, and how that's audited over time. The current admin-user
      management screen (`/admin/users`) supports deactivation but not a
      structured access-request/approval workflow.

## What this codebase already does toward HIPAA-style privacy

Listed here so a reviewer knows what's already in place versus what still
needs building — not a claim of full compliance.

- **Audit logging** (`AuditLog` model, `audit.service.ts`): assessment
  creation, review, rule changes, and report downloads are all logged with
  actor, timestamp, and action. Not yet logged: read access to an
  individual patient's record by a clinician who is just viewing it (only
  writes are currently audited) — worth deciding whether view-only access
  needs the same trail.
- **Role-based access control**: enforced server-side on every route via
  `requireAuth` + `requireRole` middleware (`backend/src/middleware/auth.middleware.ts`),
  not just hidden in the UI.
- **Password hashing**: bcrypt, 12 rounds (`auth.service.ts`).
- **No PHI in logs**: `winston` logging (`config/logger.ts`) logs request
  paths and error messages, not request bodies — a `POST /api/assessments`
  failure logs the fact that it failed, not the symptom text that was
  submitted. Verify this holds if you add any new logging.
- **`passwordHash` scoping**: explicitly stripped before any user object
  leaves the service layer (`auth.service.ts`'s `toPublicUser`), and
  covered by an automated test (`tests/api/auth.test.ts`) asserting it
  never appears in a response body.
- **Non-diagnostic framing enforced at the prompt level**: the AI system
  prompt (`triage-analysis.prompt.ts`) explicitly forbids stating a
  confirmed diagnosis, and every patient-facing surface displays "This is
  not a medical diagnosis" alongside any recommendation.

## Known gaps that must close before production, not just before "real" production

These are called out elsewhere in the codebase too (READMEs, inline
comments) but are collected here because they're compliance-relevant, not
just engineering debt:

1. **Interim auth cookie is not httpOnly** (`frontend/src/lib/api-client.ts`).
   As written, the session token is readable by any script running on the
   page — a real XSS exposure. This must become either a real Clerk
   integration or a server-issued httpOnly cookie before any real patient
   uses this.
2. **No rate limiting on `/api/assessments`** beyond the general API
   limiter — patient intake specifically isn't protected against a
   scripted flood the way `/api/auth/*` is.
3. **Symptom tagging is keyword-based**, and documented as such — a
   paraphrase a keyword list doesn't anticipate can mean a red-flag rule
   silently doesn't fire for a patient who phrased things differently than
   expected. See `backend/README.md`'s note on `symptom-tags.ts`.
4. **No automated data retention/deletion** — see the checklist above.
5. **Seeded admin credentials ship in source control** (`admin@triage.local`
   / `ChangeMe123!` in `backend/prisma/seed.ts`) — change this password
   immediately on any real deployment; see the post-deploy checklist in
   `docs/deployment/guide.md`.

## Vendor BAA status

Track signed BAAs here as they're executed — this table starts empty
because none exist yet as of this codebase's creation:

| Vendor | Purpose | BAA signed? | Date |
|---|---|---|---|
| Anthropic | AI analysis (if configured) | ☐ No | — |
| OpenAI | AI analysis (if configured) | ☐ No | — |
| Vercel | Frontend hosting | ☐ No | — |
| Railway / Render | Backend hosting | ☐ No | — |
| Supabase | Database | ☐ No | — |
| (email provider, once wired) | Notifications | ☐ No | — |
| (SMS provider, once wired) | Notifications | ☐ No | — |
