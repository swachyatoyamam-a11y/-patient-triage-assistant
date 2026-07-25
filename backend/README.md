# Backend — Intelligent Patient Triage Assistant

Node.js + Express + TypeScript + Prisma (PostgreSQL).

## What's built so far (Phase 3)

- App skeleton: `helmet`, CORS (locked to `CORS_ORIGIN`), gzip compression,
  JSON body limits, structured request/error logging (`winston`)
- Env validation on boot (`config/env.ts`) — fails fast with a clear message
  instead of crashing later on `undefined`
- JWT auth (`requireAuth`) + role guard (`requireRole(...)`), matching the
  frontend's `PATIENT / NURSE / DOCTOR / ADMIN` roles
- Rate limiting: generous default limiter on `/api/*`, a tight one on auth
  routes specifically (brute-force target)
- Central error handler: `ApiError` for expected failures, Zod validation
  errors auto-formatted, unknown errors logged and never leak details in
  production
- Full REST surface for auth, patients, assessments, appointments, reports
  (real PDF generation via `pdfkit`), admin (users, rules, audit logs), and
  analytics — see table below
- Audit logging wired into assessment updates, rule changes, and report
  downloads
- `prisma/seed.ts` — seeds the five red-flag rules named in the spec plus one
  admin account for local testing
- **AI analysis layer** (`src/ai/`): provider-agnostic (Gemini preferred,
  Anthropic Claude and OpenAI GPT-4.1 as fallbacks — pick by whichever
  API key is set),
  structured-JSON-only prompting, Zod-validated output with one automatic
  retry on a malformed response, and a hard `explanation` requirement so no
  urgency level can be saved without a stated reason. Runs automatically
  right after assessment creation; `POST /api/assessments/:id/reanalyze`
  lets clinical staff retry it manually if the first attempt failed.

- **Rule engine** (`src/ai/rules/`): deterministic, keyword-and-threshold based
  symptom tagging (`symptom-tags.ts`) feeds a small flat condition DSL
  (`allOf` / `anyOf` / `noneOf` / `ageUnder` / `ageOver`, evaluated in
  `condition-evaluator.ts`) against every active `Rule` row. Runs
  unconditionally, first, on every assessment — before the AI layer and
  with no dependency on it. A matched `EMERGENCY` rule short-circuits
  entirely (an emergency is never delayed waiting on an LLM); anything
  less severe becomes a **floor** the AI's own suggestion can escalate but
  never downgrade. Rule authoring is validated against a fixed set of
  known tags, so a typo'd tag fails loudly at rule-creation time instead
  of silently never matching.

  **Known limitation, stated plainly:** symptom tagging is substring
  keyword matching against patient-entered free text, not NLP. It will
  miss paraphrases the seed keyword lists don't anticipate ("I can't get
  a full breath in" won't match `difficulty_breathing` as written). This
  is a real gap, not a rounding error — expand `KEYWORD_TAGS` as real
  intake phrasing surfaces, and treat this file as the highest-priority
  target for test coverage in Phase 8.

## Not yet wired (later phases)

- Clerk webhook to create/sync `User` rows on real sign-up (frontend's auth
  currently talks to `/api/auth/register` + `/login` directly for local dev)
- Notification delivery (email/SMS) — `Notification` rows are modeled but
  nothing sends yet
- An admin-facing rule-builder UI (Phase 7) — `GET /api/admin/rules/tags`
  already exists so that UI has a fixed tag list to build a dropdown from,
  rather than free-text tag entry

## Testing (Phase 8)

```bash
npm test              # unit + integration + API tests (vitest)
npm run test:watch    # same, in watch mode
```

- **Unit** (`tests/unit/`): the rule condition DSL, symptom tag
  normalization (including a test that documents its known keyword-matching
  gap rather than hiding it), urgency severity ranking, the AI output
  validation schema, `ApiError`
- **Integration** (`tests/integration/`): the rule engine evaluated against
  the actual five seeded rules (mocked Prisma, real matching logic) — most
  importantly, a test asserting multiple simultaneous matches correctly
  take the single most severe result while still recording every match;
  and the recommendation service's urgency-floor enforcement — the test
  that actually proves an AI under-call can't downgrade a rule-confirmed
  urgency
- **API** (`tests/api/`, via `supertest`): health checks (live vs.
  DB-dependent ready check) and the auth register/login/me flow, including
  that `passwordHash` never appears in a response body

All of these mock Prisma (`vi.mock("@/lib/prisma", ...)`) rather than
hitting a real database — they run standalone with no `DATABASE_URL`
needed. **Caveat, stated plainly: these tests are written and reviewed for
logical correctness but have not been executed in this environment** — the
sandbox they were built in has no network access to install `vitest`
itself. Run `npm test` locally as your first step after pulling this; if
anything fails, it's a real bug to fix, not a formality.

Not yet covered: anything that needs a live Postgres (the actual
`assessment.service.ts` / `rule.service.ts` Prisma query shapes are
exercised only through mocks, not against real SQL) — that's a gap worth
closing with a `testcontainers`-backed suite before this goes to
production, not before.

## Getting started

```bash
cd backend
npm install
cp .env.example .env          # fill in DATABASE_URL and JWT_SECRET at minimum
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev                    # http://localhost:4000
```

## API surface

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | public | rate-limited |
| POST | `/api/auth/login` | public | rate-limited |
| GET | `/api/auth/me` | authenticated | |
| GET | `/api/patients/me` | patient | |
| GET | `/api/patients/me/history` | patient | |
| POST | `/api/assessments` | patient | creates intake, no analysis yet |
| GET | `/api/assessments` | nurse/doctor/admin | live queue, urgency-sorted |
| GET | `/api/assessments/:id` | authenticated | |
| PATCH | `/api/assessments/:id` | nurse/doctor/admin | review/status/notes |
| POST | `/api/assessments/:id/reanalyze` | nurse/doctor/admin | re-runs AI analysis |
| POST | `/api/appointments` | patient | |
| GET | `/api/appointments/me` | patient | |
| PATCH | `/api/appointments/:id` | nurse/doctor/admin | |
| GET | `/api/reports/:id` | authenticated | streams a PDF |
| GET/POST/PATCH/DELETE | `/api/admin/rules` | admin | red-flag rule CRUD |
| GET | `/api/admin/rules/tags` | admin | known symptom tags, for the rule builder |
| GET | `/api/admin/users` | admin | |
| PATCH | `/api/admin/users/:id/deactivate` | admin | |
| GET | `/api/admin/audit-logs` | admin | |
| GET | `/api/analytics/summary` | nurse/doctor/admin | |
| GET | `/api/health/live`, `/api/health/ready` | public | for load balancer / uptime checks |

## Structure

```
src/
├── app.ts, server.ts     # Express app + entry point, graceful shutdown
├── config/               # env validation, logger
├── lib/prisma.ts         # shared Prisma client
├── middleware/           # auth, role guard, rate limit, validation, errors
├── validators/           # Zod schemas per resource
├── services/              # business logic — controllers stay thin
├── controllers/           # request/response glue
├── routes/                # Express routers, one per resource
└── ai/                    # rule engine + AI prompts land here (Phase 5/6)
```
