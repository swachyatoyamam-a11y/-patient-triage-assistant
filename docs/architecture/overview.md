# Architecture

## System overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                  │  HTTPS  │                   │         │                 │
│  Next.js 15      │────────▶│  Express API      │────────▶│  PostgreSQL     │
│  (Vercel)        │◀────────│  (Railway/Render)  │◀────────│  (Supabase)     │
│                  │  JSON   │                   │  Prisma │                 │
└─────────────────┘         └────────┬──────────┘         └─────────────────┘
                                       │
                          ┌────────────┴────────────┐
                          │                          │
                   ┌──────▼──────┐           ┌───────▼───────┐
                   │  Rule engine │           │  AI provider   │
                   │  (in-process, │──────────▶  (Anthropic or │
                   │   no external │  only if   │   OpenAI)      │
                   │   dependency) │  no EMER-  │                │
                   └──────────────┘  GENCY match └───────────────┘
```

## Request flow: a new assessment

This is the path most worth understanding, since it's where the product's
core safety property lives.

1. Patient submits structured intake through the conversational symptom
   checker (`frontend/src/components/triage/symptom-checker.tsx`) →
   `POST /api/assessments`
2. Backend saves the intake immediately (`assessment.service.ts`) — this
   write is unconditional and never blocked by anything downstream
3. **Rule engine runs first, synchronously, with no external dependency**
   (`rule-engine.service.ts`): deterministic keyword/threshold tagging →
   flat condition DSL evaluation against every active `Rule` row
   - If the highest matched urgency is `EMERGENCY`, the flow **short-
     circuits**: a `Recommendation` is written directly from the rule
     match, with no AI call at all, and the assessment is immediately
     `AWAITING_REVIEW` at `EMERGENCY`
   - Otherwise, whatever urgency the rules found (or `null` if none)
     becomes a **floor** passed into the AI layer
4. If not short-circuited, the AI layer runs (`analyze-assessment.ts`):
   builds a structured prompt, calls the configured provider (Anthropic
   Claude preferred, OpenAI GPT-4.1 fallback), validates the JSON response
   against a strict Zod schema, retries once on a malformed response
5. `recommendation.service.ts` takes the AI's suggested urgency and the
   rule engine's floor, and saves the **more severe of the two** — the AI
   can escalate a rule's finding but the code makes it structurally
   impossible for it to downgrade one
6. Assessment lands in the clinical queue, sorted by urgency, for a nurse
   or doctor to review before anything happens next

## Why the rule engine runs before, not after, the AI

An LLM call is a network round trip with nonzero latency and nonzero
failure rate. A confirmed cardiac emergency should never wait on that, and
should never be silently missed just because a provider had an outage. The
rule engine has no external dependency and needs no more than a database
read, so it runs unconditionally, first, on every single assessment.

## Key architectural decisions and their trade-offs

| Decision | Why | Trade-off accepted |
|---|---|---|
| Rules as data (`Rule` table with JSON condition), not code | Clinical staff edit red-flag rules from the admin UI without a deploy | The condition DSL is deliberately small (allOf/anyOf/noneOf/age) — no nested logic, so some real-world rules may need decomposing into multiple simple rules |
| Provider-agnostic AI layer | Spec asked for "hybrid AI"; avoids hard vendor lock-in | Adds an abstraction layer (`AiProvider` interface) for what's currently a single active provider at a time |
| Symptom tagging via keyword matching, not NLP | Rule engine must work even if the AI provider is down | Documented, real limitation — misses paraphrases the keyword list doesn't anticipate (see `backend/README.md`) |
| Interim JWT-cookie auth instead of Clerk | Clerk needs real API keys this environment doesn't have | Explicitly temporary; cookie is written from client JS, not issued httpOnly — a real gap, documented in `frontend/README.md`, that must close before production |
| PDF reports generated on-demand, streamed | No storage cost, no stale-report risk | Regenerated on every download rather than cached |
| Clinical queue polls every 20s | Simpler than websockets/SSE for this stage | Real (documented) latency gap versus a push-based live queue |

## Data model

See `backend/prisma/schema.prisma` for the full schema. Notable modeling
choices:

- `Assessment.intake` is a JSON blob (the raw structured intake), while
  `Symptom` rows are discrete, queryable entries — both exist because the
  rule engine and reports need to read intake as a whole, while analytics
  (`analytics.service.ts`'s "common symptoms" aggregate) needs to group by
  discrete symptom names
- `RuleTrigger` is a join table recording every rule that matched an
  assessment, not just the winning one — a clinician reviewing a case can
  see all the reasoning, not just the final number
- `AuditLog.userId` / `AuditLog.assessmentId` are both nullable with
  `onDelete: SetNull` — deleting a user or assessment later must not
  silently destroy the audit trail that referenced them

## Folder structure

See `README.md` at the repo root, plus `frontend/README.md` and
`backend/README.md` for the per-package breakdown.
