/**
 * config/env.ts calls process.exit(1) if required env vars are missing —
 * correct behavior for a real server boot, but fatal for a test run if it
 * fires here. This file sets safe test-only values before any test file
 * runs, so importing "@/config/env" (directly or transitively through
 * app.ts) never trips that check.
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/triage_test";
process.env.JWT_SECRET = "test-only-secret-not-for-real-use-00000";
process.env.CORS_ORIGIN = "http://localhost:3000";
