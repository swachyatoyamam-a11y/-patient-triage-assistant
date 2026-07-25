import { Router } from "express";
import { patientController } from "@/controllers/patient.controller";
import { requireAuth, requireRole } from "@/middleware/auth.middleware";

export const patientRoutes = Router();

patientRoutes.use(requireAuth, requireRole("PATIENT"));
patientRoutes.get("/me", patientController.getProfile);
patientRoutes.get("/me/history", patientController.getHistory);
