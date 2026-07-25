import { Router } from "express";
import { prisma } from "@/lib/prisma";

export const healthRoutes = Router();

// Liveness — process is up.
healthRoutes.get("/live", (_req, res) => res.status(200).json({ status: "ok" }));

// Readiness — process is up AND can reach the database.
healthRoutes.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
