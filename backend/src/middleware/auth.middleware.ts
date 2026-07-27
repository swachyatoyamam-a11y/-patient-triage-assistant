import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "@/config/env";
import { ApiError } from "@/utils/api-error";

interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
}

/** Verifies the bearer JWT and attaches `req.user`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(ApiError.unauthorized());
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired session"));
  }
}

/** Restricts a route to one or more roles. Must run after requireAuth. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    next();
  };
}

/**
 * Self-registration only ever creates PATIENT accounts. Requesting a
 * staff/admin role (NURSE, DOCTOR, ADMIN) instead requires the caller to
 * already be authenticated as an ADMIN — otherwise anyone could mint their
 * own privileged account via the public register endpoint.
 */
export function requireAdminForPrivilegedRole(req: Request, res: Response, next: NextFunction) {
  const role = req.body?.role;
  if (!role || role === "PATIENT") {
    return next();
  }
  requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    requireRole("ADMIN")(req, res, next);
  });
}
