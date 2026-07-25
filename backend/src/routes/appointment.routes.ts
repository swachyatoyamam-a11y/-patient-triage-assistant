import { Router } from "express";
import { appointmentController } from "@/controllers/appointment.controller";
import { requireAuth, requireRole } from "@/middleware/auth.middleware";
import { validateBody } from "@/middleware/validate";
import { createAppointmentSchema, updateAppointmentSchema } from "@/validators/appointment.validator";

export const appointmentRoutes = Router();

appointmentRoutes.use(requireAuth);
appointmentRoutes.post(
  "/",
  requireRole("PATIENT"),
  validateBody(createAppointmentSchema),
  appointmentController.create
);
appointmentRoutes.get("/me", requireRole("PATIENT"), appointmentController.listMine);
appointmentRoutes.patch(
  "/:id",
  requireRole("NURSE", "DOCTOR", "ADMIN"),
  validateBody(updateAppointmentSchema),
  appointmentController.updateStatus
);
