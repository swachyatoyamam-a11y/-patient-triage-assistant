import { createApp } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { prisma } from "@/lib/prisma";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Triage backend listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  // Force-exit if something hangs longer than 10s.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
});
