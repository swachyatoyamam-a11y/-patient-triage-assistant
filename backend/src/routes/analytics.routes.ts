import { Router } from "express";
import { analyticsController } from "@/controllers/admin.controller";
import { requireAuth, requireRole } from "@/middleware/auth.middleware";

export const analyticsRoutes = Router();

analyticsRoutes.use(requireAuth, requireRole("ADMIN", "DOCTOR", "NURSE"));
analyticsRoutes.get("/summary", analyticsController.summary);
analyticsRoutes.get("/extended-summary", analyticsController.extendedSummary);
analyticsRoutes.get("/common-symptoms", analyticsController.commonSymptoms);
analyticsRoutes.get("/patients/:patientId", analyticsController.patientDetail);
