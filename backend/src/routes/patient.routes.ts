import { Router } from "express";
import { patientController } from "@/controllers/patient.controller";
import { patientProfileController } from "@/controllers/patient-profile.controller";
import { requireAuth, requireRole } from "@/middleware/auth.middleware";
import { validateBody } from "@/middleware/validate";
import {
  conditionSchema,
  updateConditionSchema,
  allergySchema,
  updateAllergySchema,
  medicationSchema,
  updateMedicationSchema,
  surgerySchema,
  updateSurgerySchema,
  emergencyInfoSchema,
} from "@/validators/patient-profile.validator";

export const patientRoutes = Router();

patientRoutes.use(requireAuth, requireRole("PATIENT"));
patientRoutes.get("/me", patientController.getProfile);
patientRoutes.get("/me/history", patientController.getHistory);

// Structured, persistent medical profile (Phase 1) — read automatically by
// the assessment pipeline instead of being re-entered every visit.
patientRoutes.get("/me/medical-profile", patientProfileController.getFullProfile);
patientRoutes.patch("/me/emergency-info", validateBody(emergencyInfoSchema), patientProfileController.updateEmergencyInfo);

patientRoutes.post("/me/conditions", validateBody(conditionSchema), patientProfileController.addCondition);
patientRoutes.patch("/me/conditions/:id", validateBody(updateConditionSchema), patientProfileController.updateCondition);
patientRoutes.delete("/me/conditions/:id", patientProfileController.removeCondition);

patientRoutes.post("/me/allergies", validateBody(allergySchema), patientProfileController.addAllergy);
patientRoutes.patch("/me/allergies/:id", validateBody(updateAllergySchema), patientProfileController.updateAllergy);
patientRoutes.delete("/me/allergies/:id", patientProfileController.removeAllergy);

patientRoutes.post("/me/medications", validateBody(medicationSchema), patientProfileController.addMedication);
patientRoutes.patch("/me/medications/:id", validateBody(updateMedicationSchema), patientProfileController.updateMedication);
patientRoutes.delete("/me/medications/:id", patientProfileController.removeMedication);

patientRoutes.post("/me/surgeries", validateBody(surgerySchema), patientProfileController.addSurgery);
patientRoutes.patch("/me/surgeries/:id", validateBody(updateSurgerySchema), patientProfileController.updateSurgery);
patientRoutes.delete("/me/surgeries/:id", patientProfileController.removeSurgery);
