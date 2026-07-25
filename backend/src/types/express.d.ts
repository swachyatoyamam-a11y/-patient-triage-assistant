import type { UserRole } from "@prisma/client";

// Augment Express's Request with the authenticated user, set by
// requireAuth() once a JWT has been verified.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        email: string;
      };
    }
  }
}

export {};
