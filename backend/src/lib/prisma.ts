import { PrismaClient } from "@prisma/client";
import { env } from "@/config/env";

/**
 * Single shared Prisma client. Guards against creating multiple clients if
 * this module is re-imported under tsx watch mode during development.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}
