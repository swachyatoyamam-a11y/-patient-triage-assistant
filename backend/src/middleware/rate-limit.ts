import rateLimit from "express-rate-limit";
import { env } from "@/config/env";

/** General API limiter — generous, just guards against abuse/runaway clients. */
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many requests. Please slow down." } },
});

/** Tighter limiter for auth endpoints — these are brute-force targets. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many login attempts. Try again later." } },
});
