# Frontend — Intelligent Patient Triage Assistant

Next.js 15 (App Router) + TypeScript + Tailwind + shadcn-style primitives.

## What's built so far (Phase 7)

- App shell: root layout, fonts (Manrope/Inter/IBM Plex Mono), dark mode via
  `ThemeProvider` (respects `prefers-color-scheme`, persists choice)
- Landing page: navbar, hero (live triage queue visual), features,
  how-it-works, testimonials, CTA, footer — all under `(marketing)`
- Auth screens: separate patient / staff / admin sign-in pages under `(auth)`,
  sharing one validated `LoginForm` component that now calls the real
  backend (`/api/auth/login`) — see the auth architecture note below
- UI primitives: `Button`, `Card`, `Badge` / `UrgencyBadge`, plus
  `Skeleton` / `EmptyState` / `ErrorState` for loading/empty/error states
  everywhere data is fetched
- **Patient portal** (`/dashboard`, `/assessment/new`, `/appointments`,
  `/reports`): assessment history, a one-question-at-a-time conversational
  symptom checker (`components/triage/symptom-checker.tsx`) that posts
  straight to the backend's rule-engine → AI-analysis pipeline, appointment
  booking, and report downloads (streamed PDFs from the backend)
- **Clinical portal** (`/clinical/dashboard`, `/clinical/patients/:id`):
  urgency-sorted live queue with search/filter, polling every 20s, and a
  per-assessment review page (clinician notes, mark reviewed/resolved,
  manual re-analyze, report download)
- **Admin portal** (`/admin/dashboard`, `/users`, `/rules`, `/audit-logs`,
  `/settings`): stats + a recharts urgency breakdown, user deactivation,
  a rule-builder that pulls the backend's known-tag list into a picker
  (rather than free-text, so a typo can't silently create a dead rule),
  and an audit log viewer. `/admin/settings` is an honest placeholder, not
  a working feature yet.

## Auth architecture — read this before touching login/middleware

Clerk is still the intended long-term auth provider, but it needs real API
keys this environment doesn't have, and `<ClerkProvider>` throws at runtime
without one. So for now:

- `LoginForm` calls the backend's own JWT endpoint directly and stores the
  token in a **plain, non-httpOnly cookie** (`lib/api-client.ts`)
- `middleware.ts` verifies that same JWT itself using `jose` (Edge-runtime
  compatible, unlike `jsonwebtoken`), reading `JWT_SECRET` from env —
  **this must match the backend's `JWT_SECRET` exactly**
- `hooks/use-current-user.ts` decodes (not verifies) the token client-side,
  for display only — never treat it as a security boundary

**This is explicitly a temporary bridge, not a production auth setup.** A
real deployment must issue the auth cookie httpOnly from a server response,
not write it from client JS as `setToken()` currently does — as written,
it's readable by any script on the page. Swapping to Clerk later touches
exactly three files: `api-client.ts` (token storage), `middleware.ts`
(verification), and `app/layout.tsx` (re-add `<ClerkProvider>`). Nothing
in the dashboard pages themselves needs to change, since they only ever
call `apiFetch`.

## Not yet wired (later phases)

- Real Clerk integration (see above)
- `/admin/settings` is a placeholder
- No websocket/SSE push for the clinical queue — it polls every 20s, which
  is a real (documented) latency gap, not a rounding error

## Testing (Phase 8)

```bash
npm test              # unit + component tests (vitest + testing-library)
npm run test:e2e       # Playwright — needs the full stack running, see tests/e2e/README.md
```

- **Unit** (`tests/unit/`): `cn()` class merging, urgency color mapping,
  `UrgencyBadge`/`Badge` rendering
- **Integration/UI** (`tests/integration/`): the symptom checker driven
  through a full click-through path with `@testing-library/user-event` —
  age validation gating, the sex-conditional pregnancy question actually
  being skipped (not just present in code), and a full submission
  asserting the exact JSON body sent to the backend
- **E2E** (`tests/e2e/`, Playwright): the same flow against a real running
  frontend + backend + seeded database — see `tests/e2e/README.md` for
  setup, since this genuinely cannot run without the full stack up

**Same caveat as the backend: these have not been executed here** — no
network access in this sandbox to install `vitest`, `@testing-library/*`,
or `playwright`. Run `npm test` locally first.

## Getting started

```bash
cd frontend
npm install
cp .env.example .env.local
# Set JWT_SECRET to the exact same value as backend/.env's JWT_SECRET
npm run dev
```

## Structure

```
src/
├── app/
│   ├── (marketing)/     # public landing page — route group, no path segment
│   ├── (auth)/          # patient/staff/admin login — route group
│   ├── (patient)/       # patient dashboard, assessments, appointments —
│   │                    # route group (paths are /dashboard, /assessment, etc.)
│   ├── clinical/        # REAL path segment — nurse/doctor queue + review
│   └── admin/           # REAL path segment — admin dashboard, users, rules
├── components/
│   ├── ui/              # button, card, badge — shadcn-style primitives
│   ├── landing/         # marketing page sections
│   ├── dashboard/        # DashboardShell — sidebar/header used by all 3 portals
│   ├── triage/           # SymptomChecker — the conversational intake flow
│   ├── forms/            # shared form components
│   └── shared/            # theme, states (skeleton/empty/error)
├── config/roles.ts      # role → allowed route prefixes (used by middleware)
├── hooks/use-current-user.ts  # decodes JWT client-side for display only
├── lib/
│   ├── api-client.ts    # fetch wrapper + interim JWT-cookie auth
│   ├── utils.ts          # cn() helper, urgency color mapping
│   └── fonts.ts
├── types/api.ts          # types matching the backend's response shapes
└── middleware.ts         # JWT verification + role-based access control
```

**Important:** `clinical` and `admin` are real folders (not `(route-group)`
syntax) — they were route groups in an earlier pass, which would have
silently collided with the patient portal's `/dashboard` URL. If you see a
`(clinical)` or `(admin)` folder reappear, that's the bug coming back.
