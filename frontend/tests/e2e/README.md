# End-to-end tests (Playwright)

These require the **full stack running for real** — they are not part of
`npm test` (which only runs vitest) and will not pass against nothing.

## Setup

1. Backend: `cd backend && npm run dev` (needs a migrated + seeded Postgres —
   see backend/README.md's Getting Started)
2. Frontend: `cd frontend && npm run dev`
3. Both need matching `JWT_SECRET` values (see frontend/README.md's auth
   architecture note) and the frontend's `NEXT_PUBLIC_API_BASE_URL` pointed
   at the backend
4. Seed a patient test account (registration isn't exposed in the UI yet,
   only via the API directly):

   ```bash
   curl -X POST http://localhost:4000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"e2e-patient@example.com","password":"testpass123",
          "firstName":"E2E","lastName":"Patient","role":"PATIENT",
          "dateOfBirth":"1990-01-01","sex":"Female"}'
   ```

5. Run: `npm run test:e2e`

Override the account or base URL with `E2E_PATIENT_EMAIL`,
`E2E_PATIENT_PASSWORD`, `E2E_BASE_URL` env vars if you seed something
different.

## What's covered

- `patient-assessment-flow.spec.ts` — full login → conversational intake →
  submission → result panel, including the sex-conditional pregnancy
  question actually appearing/not appearing correctly

## What's NOT covered yet

- Clinical portal review flow (mark reviewed, re-analyze)
- Admin rule creation and the EMERGENCY short-circuit path end-to-end
  (would need a chest-pain-plus-sweating submission and asserting the
  result skips straight to Emergency with no AI wait)
- Any of this running in CI — there's no CI config in this repo yet
  (that's part of Phase 9's deployment work, not covered here)
