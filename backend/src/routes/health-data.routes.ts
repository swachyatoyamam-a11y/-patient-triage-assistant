import { Router } from "express";
import { healthDataController } from "@/controllers/health-data.controller";
import { requireAuth, requireRole } from "@/middleware/auth.middleware";

export const healthDataRoutes = Router();

// Mounted at /api/health-data — deliberately distinct from /api/health
// (liveness/readiness) to avoid any path collision.
//
// The OAuth callback is registered BEFORE the blanket auth middleware
// below: the provider (e.g. Fitbit) redirects the patient's browser here
// directly with no Authorization header at all, so it can't sit behind
// requireAuth like every other route in this file. The patient is instead
// identified via the OAuth `state` param (set to patientId in
// provider.getAuthUrl()).
healthDataRoutes.get("/connections/callback/:provider", healthDataController.oauthCallback);

healthDataRoutes.use(requireAuth, requireRole("PATIENT"));
healthDataRoutes.get("/providers", healthDataController.listProviders);
healthDataRoutes.get("/connections", healthDataController.listConnections);
healthDataRoutes.post("/connections/:provider/connect", healthDataController.connect);
healthDataRoutes.post("/connections/:provider/sync", healthDataController.sync);
healthDataRoutes.delete("/connections/:provider", healthDataController.disconnect);
healthDataRoutes.get("/metrics", healthDataController.listMetrics);

// Shared ingest endpoint for native-app-only providers (Apple Health,
// Google Health Connect) — a future companion app calls this with a batch
// of already-normalized readings, authenticated the same way as every
// other route in this file (JWT + PATIENT role, ownership resolved from
// the token, never from a client-supplied patientId).
healthDataRoutes.post("/connections/:provider/ingest", healthDataController.ingest);
