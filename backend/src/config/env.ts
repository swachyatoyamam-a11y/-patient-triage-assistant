import { z } from "zod";
import "dotenv/config";

/**
 * Fail fast on boot if required env vars are missing/malformed, rather than
 * surfacing a confusing runtime error the first time a route needs one.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  // No default here on purpose — defaulted below only outside production.
  // A silent localhost fallback in prod means a missing env var doesn't
  // fail loudly at boot; it just rejects the real frontend's origin with a
  // confusing CORS error the first time someone loads the deployed app.
  CORS_ORIGIN: z.string().optional(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment configuration:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  const data = parsed.data;
  if (!data.CORS_ORIGIN) {
    if (data.NODE_ENV === "production") {
      console.error(
        "❌ CORS_ORIGIN is required in production — set it to your deployed frontend's exact URL " +
          "(e.g. https://your-app.vercel.app). Refusing to silently fall back to localhost."
      );
      process.exit(1);
    }
    data.CORS_ORIGIN = "http://localhost:3000";
  }

  return data as typeof data & { CORS_ORIGIN: string };
}

export const env = loadEnv();
export type Env = typeof env;
