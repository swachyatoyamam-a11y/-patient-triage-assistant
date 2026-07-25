import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

/**
 * Validates req.body against a Zod schema and replaces it with the parsed
 * (and thus type-narrowed + defaulted) result. Throws ZodError on failure,
 * which the central error handler turns into a 400.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}
