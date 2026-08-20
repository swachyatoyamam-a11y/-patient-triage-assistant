# Deployment Checklist

This records the actual deployed architecture for this app, the checks run
before and after each deploy, and what to do when something breaks. Keep
this updated if the hosting setup changes.

## Live architecture

| Layer | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Root directory `frontend`, auto-deploys on push to `main` |
| Backend | Render (free tier) | Root directory `backend`, Blueprint-managed via `render.yaml`, auto-deploys on push to `main` |
| Database | Supabase (free tier) | Postgres, connected via the **Transaction pooler** connection string |
| AI | Google Gemini | Pinned to `gemini-3.5-flash` (see `backend/src/ai/engine/providers/gemini-provider.ts`) — not the `-latest` alias, so behavior won't change without a deliberate code update |

**Known tradeoff — Render's free tier sleeps after 15 minutes of
inactivity.** The first request after a period of idle time takes
30-50 seconds to wake the backend. This was an explicit, accepted
tradeoff for a $0/month backend (see conversation history for the
Railway-vs-Render decision) — if that first-load delay becomes a
problem before a demo/interview, either upgrade to Render's paid tier
or ping the health endpoint a minute beforehand to warm it up.

## Pre-deploy checklist (before pushing anything that touches build config)

- [ ] `cd backend && npm run typecheck && npm run build && npm test` — all clean
- [ ] `cd frontend && npm run typecheck && npm run build && npm test` — all clean
- [ ] If either `tsconfig.json` changed: confirm `tsc-alias`'s compiled
      output has no leftover `@/` aliases (`grep -rn "@/" backend/dist/`
      should be empty) and the compiled server actually boots
      (`node backend/dist/server.js`)
- [ ] If `package.json` changed: confirm `package-lock.json` was
      regenerated (`npm install`, not just a manual edit) so Render/Vercel
      installs the exact same dependency tree
- [ ] No secrets in the diff — `git diff --cached | grep` for API keys,
      passwords, or JWT secrets before every commit
- [ ] If new Prisma migrations were added: confirm `render.yaml`'s
      `buildCommand` still includes `npx prisma migrate deploy` (added
      2026-08-13 — it was previously missing, meaning Render never applied
      migrations automatically). Without it, a deploy that adds a migration
      ships code expecting columns/tables the production database doesn't
      have yet

## Post-deploy verification (run after every deploy, or when debugging)

- [ ] `GET https://<render-url>/api/health/ready` → `{"status":"ok"}`
      (this specifically checks DB connectivity, unlike `/health/live`)
- [ ] Load the Vercel URL directly in a browser, open dev tools, confirm
      **zero CORS errors** in the console when logging in
- [ ] Log in as `admin@triage.local` and confirm the dashboard shows the
      real patient/assessment counts (170 patients as of the last import)
- [ ] Open a patient assessment and click **Re-analyze** — confirm the
      recommendation's `Source:` line shows `gemini-3.5-flash`, not an
      error, and the reasoning is clinically sensible
- [ ] Click **Mark reviewed** on an assessment and confirm the status
      badge and timeline update

## Environment variables reference (where things actually live)

**Render (`triage-backend` service → Environment tab):**
- `DATABASE_URL` — Supabase pooled connection string (`%40`-encoded
  password, port `5432`, `pooler.supabase.com` host)
- `JWT_SECRET` — Render auto-generated this; **must exactly match**
  Vercel's `JWT_SECRET`
- `CORS_ORIGIN` — must exactly match the Vercel URL, no trailing slash
- `GEMINI_API_KEY` — the real key
- `NODE_ENV=production` — set at the platform level; note this is *why*
  `npm install` needs `--include=dev` in the build command (see
  `render.yaml`'s comment) — devDependencies are needed for the build
  step only, not at runtime
- `HEALTH_TOKEN_ENCRYPTION_KEY` / `FITBIT_CLIENT_ID` / `FITBIT_CLIENT_SECRET`
  / `FITBIT_REDIRECT_URI` — all optional; unset means Demo Health Data
  still works and Fitbit shows as "not yet configured" in the UI (not an
  error)

**Vercel (Project → Settings → Environment Variables):**
- `NEXT_PUBLIC_API_BASE_URL` — the Render backend URL + `/api`
- `JWT_SECRET` — **must exactly match** Render's value byte-for-byte

**Supabase:** no app-level env vars — just the connection string above.

## Known, intentional tradeoffs (not bugs)

- **Seeded demo credentials are public knowledge on purpose**:
  `admin@triage.local` / `ChangeMe123!`, and every imported sample
  patient uses `Patient123!`. This is a portfolio demo meant to be
  logged into by recruiters/interviewers — don't point this deployment
  at real patient data without changing these first (see
  `docs/deployment/compliance.md` for what "real deployment" actually
  requires beyond credentials).
- **Next.js is pinned to `15.0.8`**, not the latest 15.x/16.x, to keep
  the CVE-2025-66478 security fix isolated from any other breaking
  changes. Revisit this pin periodically for further security patches.
- **Gemini model is pinned**, not tracking `-latest`. If Google
  deprecates `gemini-3.5-flash`, requests will start failing with a 404
  — check available models for this API key
  (`GET https://generativelanguage.googleapis.com/v1beta/models?key=...`)
  and update the constant in `gemini-provider.ts`, not just swap back to
  a `-latest` alias.

## Troubleshooting quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| Login succeeds but every protected page redirects back to login | `JWT_SECRET` mismatch between Render and Vercel | Copy Render's exact value into Vercel's env var, redeploy Vercel |
| Browser console shows a CORS error on login | `CORS_ORIGIN` on Render doesn't exactly match the Vercel URL | Fix the value in Render's Environment tab (no trailing slash), save (auto-redeploys) |
| First request after a while takes 30-50s | Render free tier cold start | Expected — see "known tradeoff" above |
| Render build fails with `TS7016` "could not find a declaration file" | A `devDependency` needed at build time didn't install | Confirm `render.yaml`'s buildCommand still has `--include=dev`, and that the package is listed in `dependencies` not `devDependencies` if it's needed for `tsc`/`prisma generate` |
| Render build fails on a `tsconfig.json` option | TypeScript version drift between local and Render | Check for deprecated options (`moduleResolution: "node"`, bare `baseUrl`) — see the fix already applied for reference |
| Vercel build fails with "Vulnerable version of Next.js detected" | A disclosed CVE in the pinned Next.js version | Check Next.js's security advisories for the patched release in the *same* minor version line, upgrade, verify locally, push |
| `Re-analyze` returns `analysisFailed` / no AI recommendation | `GEMINI_API_KEY` missing/invalid on Render, or the pinned model was retired | Check Render logs for the specific error; test the key directly against the Gemini API if needed |
