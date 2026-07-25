import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "@/utils/api-error";
import { logger } from "@/config/logger";
import { env } from "@/config/env";

/**
 * Single place all errors funnel through. Keeps response shape consistent
 * and makes sure we never leak stack traces / internal messages to a client
 * in production.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, details: err.details ?? undefined },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { message: "Validation failed", details: err.flatten().fieldErrors },
    });
  }

  logger.error("Unhandled error", {
    err,
    path: req.path,
    method: req.method,
  });

  return res.status(500).json({
    error: {
      message:
        env.NODE_ENV === "production"
          ? "Something went wrong. Please try again."
          : (err as Error)?.message ?? "Unknown error",
    },
  });
}
