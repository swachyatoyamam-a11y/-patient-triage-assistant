# Environment Variables Reference

Full details live in `backend/.env.example` and `frontend/.env.example` as
inline comments — this page is a consolidated at-a-glance reference.

## Backend (`backend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | No (default 4000) | |
| `NODE_ENV` | No (default development) | Set to `production` on deploy |
| `CORS_ORIGIN` | Yes | Must exactly match the frontend's deployed URL. Enforced at boot: the process refuses to start in production without it rather than silently falling back to `localhost` |
| `DATABASE_URL` | Yes | Postgres connection string — use Supabase's pooled connection string in production |
| `JWT_SECRET` | Yes | Min 16 chars; generate with `openssl rand -base64 48`. **Must exactly match the frontend's `JWT_SECRET`** (interim auth bridge — see `frontend/README.md`) |
| `JWT_EXPIRES_IN` | No (default 8h) | |
| `GEMINI_API_KEY` | One of these three | See `docs/deployment/compliance.md` before setting for real patient data — requires a signed BAA/DPA with Google. Preferred over OpenAI/Anthropic if more than one is set. Pinned to a specific model (`gemini-3.5-flash`, see `src/ai/engine/providers/gemini-provider.ts`) rather than a `-latest` alias, so behavior doesn't change without a deliberate code update |
| `OPENAI_API_KEY` | One of these three | Same BAA requirement |
| `ANTHROPIC_API_KEY` | One of these three | Same BAA requirement |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | No | Not yet wired to any code — reserved for the notification feature |
| `SMS_PROVIDER_SID` / `SMS_PROVIDER_AUTH_TOKEN` / `SMS_FROM_NUMBER` | No | Same — reserved, not yet wired |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | No | Defaults: 15 min window, 100 requests |
| `HEALTH_TOKEN_ENCRYPTION_KEY` | Only once a real (non-Demo) health-data provider is connected | Base64-encoded 32-byte AES-256-GCM key for encrypting OAuth tokens at rest (`src/utils/crypto.ts`). Generate with `openssl rand -base64 32`. The Demo Health Data provider needs no secrets at all and works without this being set; it's required the moment a real provider (e.g. Fitbit) is configured, since connecting one writes an encrypted token to `HealthConnection` |
| `FITBIT_CLIENT_ID` / `FITBIT_CLIENT_SECRET` | No — Fitbit stays shown-but-disabled in the UI until set | Self-service, free registration at `dev.fitbit.com`. Activates the real Fitbit OAuth2 connector (`src/health/providers/fitbit-provider.ts`) automatically once both are present — no code change needed |
| `FITBIT_REDIRECT_URI` | Only if `FITBIT_CLIENT_ID` is set | Must exactly match the callback URL registered in the Fitbit dev app, e.g. `https://api.example.com/api/health-data/connections/callback/FITBIT` |
| `FRONTEND_URL` | No (falls back to `CORS_ORIGIN`) | Where the OAuth callback redirects the browser back to after a provider connection completes. Only matters if it needs to differ from `CORS_ORIGIN` |

Validated on boot by `backend/src/config/env.ts` — the process exits
immediately with a clear error if a required variable is missing or
malformed, rather than failing confusingly later.

## Frontend (`frontend/.env.local`)

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Backend URL + `/api`, e.g. `https://api.example.com/api` |
| `JWT_SECRET` | Yes | **Must exactly match the backend's value.** Server-only — no `NEXT_PUBLIC_` prefix, so it never reaches the browser bundle. Used by `middleware.ts` to verify the session cookie |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Not yet | Reserved for when Clerk is actually wired in — see the auth architecture note in `frontend/README.md`. Setting these currently does nothing, since `<ClerkProvider>` isn't mounted |
| `NEXT_PUBLIC_ENABLE_DARK_MODE` | No | Feature flag, currently always effectively on regardless of this value (dark mode is controlled by `ThemeProvider`, not this flag — flagged here as a loose end worth resolving) |

## A note on the `JWT_SECRET` duplication

Having the same secret in two separate `.env` files is a direct
consequence of the interim auth approach (no Clerk yet) and is the first
thing that should be cleaned up when Clerk is wired in for real — at that
point the frontend no longer needs to verify JWTs itself, Clerk's own
session handling replaces it, and this duplication goes away entirely.
