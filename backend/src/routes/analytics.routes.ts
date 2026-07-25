import { Router } from "express";
import { analyticsController } from "@/controllers/admin.controller";
import { requireAuth, requireRole } from "@/middleware/auth.middleware";

export const analyticsRoutes = Router();

analyticsRoutes.use(requireAuth, requireRole("ADMIN", "DOCTOR", "NURSE"));
analyticsRoutes.get("/summary", analyticsController.summary);
analyticsRoutes.get("/common-symptoms", analyticsController.commonSymptoms);
