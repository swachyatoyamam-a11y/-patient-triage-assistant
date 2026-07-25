import { Router } from "express";
import { assessmentController } from "@/controllers/assessment.controller";
import { requireAuth, requireRole } from "@/middleware/auth.middleware";
import { validateBody } from "@/middleware/validate";
import { createAssessmentSchema, updateAssessmentSchema } from "@/validators/assessment.validator";

export const assessmentRoutes = Router();

assessmentRoutes.use(requireAuth);

// Patients create their own assessments.
assessmentRoutes.post(
  "/",
  requireRole("PATIENT"),
  validateBody(createAssessmentSchema),
  assessmentController.create
);

// Clinical staff view the queue and individual assessments.
assessmentRoutes.get("/", requireRole("NURSE", "DOCTOR", "ADMIN"), assessmentController.list);
assessmentRoutes.get("/:id", assessmentController.getById);
assessmentRoutes.patch(
  "/:id",
  requireRole("NURSE", "DOCTOR", "ADMIN"),
  validateBody(updateAssessmentSchema),
  assessmentController.update
);
assessmentRoutes.post(
  "/:id/reanalyze",
  requireRole("NURSE", "DOCTOR", "ADMIN"),
  assessmentController.reanalyze
);
