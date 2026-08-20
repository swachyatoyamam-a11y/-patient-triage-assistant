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

/**
 * Caps the app's own Prisma connection pool instead of relying on Prisma's
 * CPU-based default (`num_physical_cpus * 2 + 1`). Supabase's session-mode
 * pooler holds one backend slot per client for the connection's entire
 * lifetime and enforces a hard project-wide cap (`pool_size`) — a
 * long-running app holding close to that cap leaves no room for anything
 * else that needs a connection, including `prisma migrate deploy` during
 * the next deploy's build step. This only appends query parameters to
 * whatever DATABASE_URL is already configured; it never reads, logs, or
 * needs to know the credential itself, and respects an explicit
 * connection_limit/pool_timeout if one is ever set directly on the URL.
 */
function datasourceUrl(): string {
  const url = new URL(env.DATABASE_URL);
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "5");
  if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
  return url.toString();
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasources: { db: { url: datasourceUrl() } },
  });

if (env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}
