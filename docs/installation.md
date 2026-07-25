# Installation Guide (local development)

> **On Windows with PostgreSQL installed natively (not Docker)?** See the
> "Local development setup (Windows)" section in the root `README.md` —
> it covers the winget install, setting the `postgres` password, a
> Windows-specific Prisma migration gotcha, and importing sample patient
> data in full. This document covers the general/Docker path.

## Prerequisites

- Node.js 20+ and npm
- A PostgreSQL database (local install, Docker, or a free Supabase project)
- A Gemini, Anthropic, and/or OpenAI API key, if you want the AI analysis
  layer to actually run — the app works without one (assessments still
  get saved and the rule engine still runs), but `analysisFailed: true`
  will come back on every non-emergency assessment until a key is set

## 1. Database

Point `DATABASE_URL` at any Postgres instance. For local development,
Docker is the fastest path:

```bash
docker run --name triage-postgres -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 -d postgres:16
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL, generate a JWT_SECRET
#   openssl rand -base64 48
# Set GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY if you want AI analysis to run (Gemini is preferred if more than one is set)

npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
# → http://localhost:4000
```

Confirm it's up: `curl http://localhost:4000/api/health/ready` should
return `{"status":"ok"}`.

### Optional: import patient data (Excel/CSV/JSON)

`backend/prisma/import-patients.ts` is a general-purpose importer —
point it at any `.xlsx`, `.xls`, `.csv`, or `.json` file of patient
records and it validates, auto-fixes what it safely can, and creates
real Users/Patients/Assessments/Vitals from it, running each one through
the actual rule engine (not just copying a label).

```bash
npm run prisma:import                                # defaults to prisma/data/sample-patients.json
npm run prisma:import -- "C:\path\to\your\file.xlsx"  # any file
```

It's idempotent per source file, and safely handles different files
reusing the same Patient ID codes for different people without
overwriting anything. See the root `README.md`'s "Local development
setup" section, step 4, for the full behavior (validation rules, column
name flexibility, and exactly how duplicates/re-runs are handled).

## 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
# Set JWT_SECRET to the EXACT SAME value as backend/.env's JWT_SECRET
npm run dev
# → http://localhost:3000
```

## 4. Log in

The seed script creates one admin account:
- Email: `admin@triage.local`
- Password: `ChangeMe123!`

Go to `http://localhost:3000/login/admin` to sign in as that account. To
try the patient flow, register a patient account directly against the API
(there's no public patient sign-up form yet — see
`docs/future-improvements.md`):

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@example.com","password":"testpass123",
       "firstName":"Test","lastName":"Patient","role":"PATIENT",
       "dateOfBirth":"1990-01-01","sex":"Female"}'
```
Then log in at `http://localhost:3000/login/patient` with those credentials.

If you ran the sample-data import above, you can log in as any imported
patient instead — `p001@triage.local` through `p020@triage.local`, all
with password `Patient123!` (patient codes match the `Patient ID` column
in the sample dataset, e.g. `p001` = Rahul Sharma).

## 5. Run the tests

```bash
cd backend && npm test    # unit + integration + API (mocked Prisma, no DB needed)
cd frontend && npm test   # unit + component tests
```

E2E tests need the full stack running — see `frontend/tests/e2e/README.md`.

**Note:** these test suites were written and reviewed for correctness but
have not been executed by the assistant that built this codebase (no
network access in that environment to install the test runners). Treat
`npm test` as your actual first verification step, not a formality.

## Troubleshooting

- **Login succeeds but every protected page redirects back to login** —
  almost always a `JWT_SECRET` mismatch between `backend/.env` and
  `frontend/.env.local`. They must be byte-for-byte identical.
- **Assessments save but `analysisFailed: true` every time** — no
  `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` set in
  `backend/.env`, or the key is invalid. Check the backend's console logs
  for the specific error.
- **`prisma migrate dev` fails to connect** — confirm the Postgres
  container/instance is actually running and `DATABASE_URL` matches its
  credentials exactly.
- **`prisma migrate dev` fails with `spawn UNKNOWN` or "An Application
  Control policy has blocked this file"** — a locked-down Windows machine
  (WDAC/AppLocker) is blocking Prisma's unsigned `schema-engine-windows.exe`
  subprocess. See the root `README.md`'s Windows setup section for the
  `psql`-based workaround — don't try to disable the security policy.
