import winston from "winston";
import { env } from "@/config/env";

/**
 * Structured logging. In production this should ship to a log aggregator
 * (Datadog/CloudWatch/etc) rather than stdout only — wire that transport
 * in Phase 9 deployment config.
 */
export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.NODE_ENV === "production" ? winston.format.json() : winston.format.simple()
  ),
  defaultMeta: { service: "triage-backend" },
  transports: [new winston.transports.Console()],
});
