# Intelligent Patient Triage Assistant

A hybrid AI + rule-based clinical triage system: patients report symptoms through a
conversational intake flow, a deterministic rule engine flags red-flag emergencies,
and an LLM layer produces an *explainable, non-diagnostic* urgency recommendation
that routes patients to the right level of care.

> ⚠️ **Not a certified medical device.** This software assists triage prioritization
> and does not diagnose. All AI/rule output must be reviewed by a licensed clinician
> before acting on it. **Before any real deployment**, read `docs/deployment/compliance.md`
> in full — it covers the clinical safety review, vendor BAAs, and legal sign-off this
> system requires before it touches real patient data. That document is not optional
> reading; treat it as a hard gate, not a formality.

## Start here

- **New to this repo?** → `docs/installation.md` — local setup, both packages, in order
- **Deploying for real?** → `docs/deployment/compliance.md` **first**, then `docs/deployment/guide.md`
- **Understanding how it works?** → `docs/architecture/overview.md`
- **Calling the API?** → `docs/api/reference.md`
- **What's not built yet?** → `docs/future-improvements.md`

## Local development setup (Windows)

This section is the complete, practical path to a working local instance —
prerequisites, database, environment files, running the app, sample data,
and troubleshooting. `docs/installation.md` covers the same ground with
Docker/other-OS alternatives; this version documents exactly what a native
Windows + PostgreSQL setup looks like.

### Prerequisites

- **Node.js 20+ and npm** — check with `node --version` / `npm --version`
- **PostgreSQL 16** — see setup below if not already installed
- **Optional:** a Gemini, Anthropic, or OpenAI API key, only needed for
  AI-generated recommendations (the rule engine and the rest of the app
  work without one)

### 1. Install and configure PostgreSQL

Install via [winget](https://learn.microsoft.com/windows/package-manager/winget/) (run in an elevated PowerShell if prompted):

```bash
winget install --id PostgreSQL.PostgreSQL.16 --accept-package-agreements --accept-source-agreements
```

This registers a Windows service named `postgresql-x64-16` that starts
automatically on boot. Check it any time with:

```powershell
Get-Service postgresql-x64-16
```

If it's `Stopped`, start it with `Start-Service postgresql-x64-16` (needs
an elevated/admin PowerShell — Windows will prompt for permission).

**Setting the `postgres` superuser password** (a silent winget install
doesn't set one for you): temporarily allow local trust auth, set the
password, then restore secure auth.

```powershell
# 1. Edit C:\Program Files\PostgreSQL\16\data\pg_hba.conf — change every
#    "scram-sha-256" to "trust". IMPORTANT: save as plain UTF-8, NO BOM
#    (PowerShell's `Set-Content -Encoding utf8` adds one and crashes
#    Postgres on restart — use `[System.IO.File]::WriteAllText(path, text,
#    (New-Object System.Text.UTF8Encoding($false)))` instead).
# 2. Restart-Service postgresql-x64-16
# 3. psql -U postgres -h 127.0.0.1 -c "ALTER USER postgres WITH PASSWORD 'your-password-here';"
# 4. Change "trust" back to "scram-sha-256" in pg_hba.conf (same no-BOM rule)
# 5. Restart-Service postgresql-x64-16
```

Then create the app's database:

```bash
createdb -U postgres -h 127.0.0.1 triage_db
```

*(`psql`, `createdb`, etc. live in `C:\Program Files\PostgreSQL\16\bin` —
add that to your `PATH`, or call them with the full path.)*

### 2. Configure environment files

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
- `DATABASE_URL=postgresql://postgres:<your-password>@localhost:5432/triage_db`
- `JWT_SECRET=` — generate a random secret, e.g. in PowerShell:
  ```powershell
  [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
  ```
- Leave `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` blank for now (see step 6)

```bash
cd frontend
cp .env.example .env.local
```

Edit `frontend/.env.local`:
- `JWT_SECRET=` — **must be byte-for-byte identical** to `backend/.env`'s value
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api`

### 3. Install dependencies and set up the schema

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
```

> **If `prisma migrate dev` fails with `spawn UNKNOWN` or "An Application
> Control policy has blocked this file"** — some locked-down Windows
> machines (managed/corporate laptops with WDAC or AppLocker configured)
> block Prisma's unsigned `schema-engine-windows.exe` from running as a
> subprocess, even though `prisma generate` still works fine (it doesn't
> need that binary). Work around it by applying the schema directly with
> `psql` instead of the Prisma CLI:
> ```bash
> psql -U postgres -h 127.0.0.1 -d triage_db -f backend/prisma/migrations/20260726000000_init/migration.sql
> ```
> This is the exact SQL Prisma would have generated — Prisma Client works
> identically against it either way. This is a machine-specific security
> policy, not something to disable; don't attempt to bypass it.

```bash
cd frontend
npm install
```

If `npm install` reports packages "not yet covered by allowScripts" (a
script-approval gate some npm configurations enforce), review and approve
the legitimate ones — Prisma, bcrypt, esbuild, sharp, Clerk are all
expected to need their install scripts:

```bash
npm approve-scripts --allow-scripts-pending   # lists what's pending
npm approve-scripts <pkg> <pkg> ...           # approve by name
npm install                                    # rerun so scripts execute
```

If `bcrypt` ends up without a compiled native binding (check
`node -e "require('bcrypt')"` doesn't error), run `npm rebuild bcrypt`
inside `backend/`.

### 4. Seed rules/admin user, then import patient data

```bash
cd backend
npm run prisma:seed     # deterministic red-flag rules + admin@triage.local
npm run prisma:import   # imports backend/prisma/data/sample-patients.json (default, no arg)
```

#### Importing Excel/CSV files (`backend/prisma/import-patients.ts`)

The importer is a general-purpose, reusable script — point it at any
`.xlsx`, `.xls`, `.csv`, or pre-converted `.json` file:

```bash
cd backend
npm run prisma:import -- "C:\path\to\your\file.xlsx"
# or a relative path into the repo, e.g.:
npm run prisma:import -- prisma/data/sample-patients-150.json
```

(the `--` is required so npm passes the path through to the script rather
than treating it as an npm flag)

**What it does on every run:**
1. **Parses** every row of the sheet (first sheet only for spreadsheets).
2. **Validates** each row. A row missing `Patient ID`, `Name`, `Chief
   Complaint`, `Symptoms`, `Gender`, or a plausible `Age` (0–120) is
   **skipped** and logged with the reason — nothing partial gets written
   for it. Everything else is auto-fixed rather than failing the row:
   an unparseable `Duration` defaults to 0 hours, an out-of-range vital
   (heart rate, blood pressure, temperature, SpO2) is dropped to `null`,
   and an unrecognized triage label defaults to `ROUTINE` — each logged
   as a warning so you can see exactly what was adjusted.
3. **Maps columns flexibly.** Both column vocabularies seen so far work
   out of the box — a single free-text `Vitals` string (e.g. `"BP
   170/100, HR 110"`) *or* structured `Heart Rate` / `Blood Pressure` /
   `Temperature (°C)` / `SpO2 (%)` columns; `Expected Triage` *or*
   `Expected Triage Level`, in either's vocabulary (`Self-care`,
   `Non-Urgent`, `Less Urgent`, etc. — all map onto the app's 4 urgency
   levels). See `COLUMN_ALIASES` at the top of the script to add a new
   header spelling without renaming existing ones.
4. **Runs the real rule engine** on every row (genuine red flags like
   chest pain + sweating short-circuit to `EMERGENCY` exactly as the
   live API would) and only falls back to the row's own expected-triage
   value for cases the rule engine doesn't catch — clearly labeled as
   such in the recommendation's explanation text.
5. **Stores vitals as structured data** (a `Vitals` row per assessment —
   heart rate, systolic/diastolic BP, temperature, SpO2 — queryable, not
   just text) in addition to folding them into the assessment's `intake`
   JSON so they render immediately on the existing patient-detail page.

**Duplicate / re-run handling** — identity is scoped **per source file**,
not just by the sheet's own `Patient ID` column, since different files
may reuse the same codes for entirely different people:
- The default file (`prisma/data/sample-patients.json`) keeps its
  original plain logins (`p001@triage.local`, ...) for backward
  compatibility.
- Every other file's codes are suffixed with a slug of its filename
  (e.g. `p001-sample-patients-150@triage.local`), so importing a new
  file that happens to reuse `P001`–`P020` **never overwrites or
  collides with** patients from an earlier import — both are kept as
  distinct records.
- Re-running the **exact same file** is a no-op (rows are skipped as
  exact duplicates, matched by a content hash).
- Editing the data for a Patient ID **within the same file/batch**
  before re-running updates that patient's demographics and adds a new
  assessment (treated as a new encounter), rather than creating a
  duplicate patient.

The script prints a summary at the end — rows in file, created, updated,
skipped as duplicate, skipped as invalid — plus the resulting total
patient/assessment counts in the database.

**To import additional or different patient records**, just point the
command at the new file — no code changes needed unless it introduces a
genuinely new column name (see `COLUMN_ALIASES` above).

### 5. Start the app (and restart it later)

```bash
cd backend && npm run dev    # → http://localhost:4000
```
```bash
cd frontend && npm run dev   # → http://localhost:3000
```

Confirm the backend is up: `curl http://localhost:4000/api/health/ready`
should return `{"status":"ok"}`. These are the only two commands you need
to bring everything back up after a reboot — Postgres runs as a Windows
service and starts on its own.

### 6. Log in

- **Admin** — `http://localhost:3000/login/admin` — `admin@triage.local` / `ChangeMe123!`
- **Care team (clinical queue)** — needs a NURSE/DOCTOR-role account, or use the admin account, which can also reach `/clinical/dashboard`
- **Sample patients** — `http://localhost:3000/login/patient` — password `Patient123!` for all of them:
  - Original 20-patient batch: `p001@triage.local` through `p020@triage.local` (e.g. `p001` = Rahul Sharma, chest pain)
  - 150-patient batch: `p001-sample-patients-150@triage.local` through `p150-sample-patients-150@triage.local` (e.g. `p001-sample-patients-150` = Ishita Verma, allergic rash) — suffixed because these files reuse the same `P001`–`P020` codes for different people; see the import section below for why

Change the admin password immediately if this ever leaves a local dev machine.

### 7. Adding an AI provider key (Gemini, Anthropic, or OpenAI)

Without a key, the rule engine still runs on every assessment, but
non-emergency cases get `analysisFailed: true` instead of an AI-generated
recommendation. To enable it:

1. Add one of these to `backend/.env` (see
   `src/ai/engine/analyze-assessment.ts:selectProvider` for the exact
   priority order if more than one is set — Gemini wins, then Anthropic,
   then OpenAI):
   - `GEMINI_API_KEY=...` (get one from [Google AI Studio](https://aistudio.google.com/apikey)) — uses `gemini-2.5-pro`
   - `ANTHROPIC_API_KEY=sk-ant-...` — uses `claude-sonnet-5`
   - `OPENAI_API_KEY=sk-...` — uses `gpt-4.1`
2. Restart the backend (`npm run dev` picks it up on the next request —
   no need to touch the database)
3. Trigger a fresh assessment, or click **Re-analyze** on an existing one
   in the clinical dashboard, to see the AI-generated recommendation

### Troubleshooting

- **Login succeeds but every protected page redirects back to login** —
  `JWT_SECRET` mismatch between `backend/.env` and `frontend/.env.local`.
  They must be byte-for-byte identical.
- **Assessments save but `analysisFailed: true` every time** — no
  `GEMINI_API_KEY`/`ANTHROPIC_API_KEY`/`OPENAI_API_KEY` set, or the key is
  invalid. Check the backend's console logs for the specific error.
- **`prisma migrate dev` fails with `spawn UNKNOWN` or an Application
  Control policy error** — see the workaround in step 3 above (apply the
  SQL directly via `psql`). This is a Windows security policy blocking
  Prisma's unsigned migration binary, not a bug in the app.
- **`prisma migrate dev` fails to connect at all** — confirm
  `Get-Service postgresql-x64-16` shows `Running` and `DATABASE_URL`'s
  credentials match what you set on the `postgres` user.
- **Postgres won't start after editing `pg_hba.conf`** — almost always a
  UTF-8 BOM accidentally written into the file (see step 1). Re-save it
  as BOM-less UTF-8 and restart the service.
- **`bcrypt` throws on import/require** — its native binding wasn't
  compiled; run `npm rebuild bcrypt` in `backend/`.
- **`npm install` warns about scripts "not yet covered by allowScripts"**
  — see step 3; approve the legitimate packages and rerun `npm install`.
- **Port already in use** (4000 or 3000) — another process (often a
  previous `npm run dev` still running in the background) is bound to it;
  stop that process or change `PORT`/pass `-p` to `next dev`.

## Repo layout

```
patient-triage-assistant/
├── frontend/   # Next.js 15 + TypeScript + Tailwind — see frontend/README.md
├── backend/    # Node.js + Express + Prisma + PostgreSQL — see backend/README.md
└── docs/
    ├── installation.md              # local dev setup, start to finish
    ├── future-improvements.md       # honest backlog
    ├── architecture/overview.md     # system design, data flow, key decisions
    ├── api/reference.md             # every endpoint, request/response shapes
    └── deployment/
        ├── compliance.md            # read this before any real deployment
        ├── guide.md                 # Vercel + Railway/Render + Supabase
        └── environment-variables.md # consolidated env var reference
```

## The one thing most worth understanding

The rule engine (`backend/src/ai/rules/`) runs **before** the AI layer, on
every single assessment, with no dependency on any external API. A
deterministic red flag — chest pain with sweating, difficulty breathing,
a head injury — short-circuits straight to `EMERGENCY` without waiting on
an LLM round trip. For anything less clear-cut, the rule engine's finding
becomes a floor the AI can escalate but the code makes it structurally
impossible for the AI to downgrade. See `docs/architecture/overview.md`
for the full request flow.

## Build history

This was built in nine phases, each reviewed before moving to the next.
Two honest notes carried through from that process, because they matter
more than a changelog entry:

- **A real routing bug was caught and fixed in Phase 7**: `(clinical)` and
  `(admin)` had been created as Next.js route groups, which add no URL
  segment — both would have silently collided with the patient portal's
  `/dashboard` URL. Renamed to real path segments.
- **Auth currently runs on an interim JWT-cookie bridge, not Clerk** —
  Clerk needs real API keys this build environment never had. This is
  documented as a known, temporary gap (not a hidden one) in
  `frontend/README.md`'s auth architecture section, with the specific
  security property it's missing (an httpOnly cookie) called out in
  `docs/deployment/compliance.md`.

Every package README (`frontend/README.md`, `backend/README.md`) documents
what's built, what's deliberately deferred, and why — read those for
implementation-level detail beyond what's summarized here.

## Testing

```bash
cd backend && npm test    # unit + integration + API — vitest + supertest
cd frontend && npm test   # unit + component — vitest + testing-library
cd frontend && npm run test:e2e   # Playwright — needs the full stack running
```

These suites were written and traced by hand for correctness but have not
been executed against a real `npm install` — the environment this was
built in had no network access to install the test runners. Running
`npm test` locally is genuinely the first thing to do after pulling this,
not a formality.
