# Deployment Guide

**Read `docs/deployment/compliance.md` before deploying anywhere with real
patient data.** This guide covers infrastructure mechanics; that one covers
the legal/compliance gates that must clear first.

## Target stack (per project spec)

- Frontend → Vercel
- Backend → Railway or Render
- Database → Supabase PostgreSQL

## 1. Database (Supabase)

1. Create a new Supabase project
2. Copy the connection string (Settings → Database → Connection string,
   **use the pooled connection string** for the app, not the direct one —
   Prisma's connection pool plus Supabase's own pooler both trying to
   manage connections directly tends to exhaust the connection limit)
3. Set it as `DATABASE_URL` in the backend environment (step 2 below)
4. Run migrations against it once, from your local machine or a one-off
   deploy step:
   ```bash
   cd backend
   DATABASE_URL="<supabase connection string>" npx prisma migrate deploy
   DATABASE_URL="<supabase connection string>" npm run prisma:seed
   ```
   Note: `prisma migrate deploy` (not `migrate dev`) is the correct command
   for a non-interactive production apply — `migrate dev` will prompt and
   is meant for local development only.

## 2. Backend (Railway or Render)

Both work the same way for this app: point them at `backend/` as the root
directory, set the build command to `npm install && npm run build` and the
start command to `npm start`.

Required environment variables (see `backend/.env.example` for the full
list with comments):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | The Supabase pooled connection string from step 1 |
| `JWT_SECRET` | Generate with `openssl rand -base64 48` — do not reuse the value from `.env.example` |
| `CORS_ORIGIN` | Your Vercel frontend URL, exactly (no trailing slash) |
| `NODE_ENV` | `production` |
| `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` | See compliance doc before setting these for real patient data |
| `SMTP_*` | Only if notification delivery is wired up (not yet built — see backend/README.md) |

Point the platform's health check at `GET /api/health/ready` (checks DB
connectivity), not `/api/health/live` (which would report healthy even if
the database is unreachable).

## 3. Frontend (Vercel)

Point Vercel at `frontend/` as the root directory — it auto-detects
Next.js.

Required environment variables:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Your deployed backend URL + `/api` |
| `JWT_SECRET` | **Must exactly match the backend's `JWT_SECRET`** — this is the interim auth bridge described in `frontend/README.md`; a mismatch means every login silently fails at the middleware layer, not at login itself, which is a confusing failure mode worth knowing about ahead of time |

Do **not** set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` until Clerk is actually
wired in (see the auth architecture note in `frontend/README.md`) — the
app currently doesn't use it, and setting it without also re-adding
`<ClerkProvider>` to `app/layout.tsx` does nothing.

## 4. Post-deploy checklist

- [ ] Hit `GET /api/health/ready` on the deployed backend directly — confirm `200`
- [ ] Log in as the seeded admin account (`admin@triage.local` /
      `ChangeMe123!`) and **change that password immediately** — it's a
      known credential sitting in source control
- [ ] Confirm CORS: a login attempt from the deployed frontend should not
      show CORS errors in the browser console
- [ ] Submit one test assessment with `chest_pain` + `sweating` in the
      symptom text and confirm it resolves to `EMERGENCY` with no AI
      round-trip delay — this is the single most important behavior to
      verify before trusting this in front of real patients
- [ ] Confirm PDF report download works (`GET /api/reports/:id`)

## What this guide does not cover

- CI/CD pipeline configuration — no CI config exists in this repo yet;
  wiring `npm test` to run automatically on every push is a reasonable
  next step but wasn't built here
- Horizontal scaling / load balancing beyond what Railway/Render provide
  out of the box
- Log aggregation — `winston` currently logs to stdout only; a real
  deployment should ship those logs to Datadog/CloudWatch/etc (noted
  inline in `backend/src/config/logger.ts`)
- Secrets management beyond platform-native environment variables (i.e.
  no Vault/AWS Secrets Manager integration)
