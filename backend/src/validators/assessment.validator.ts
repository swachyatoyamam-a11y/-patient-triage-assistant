import { z } from "zod";

// Structured intake — mirrors the conversational questions from the
// symptom-checker UI (Phase 5 AI layer reads this shape).
export const createAssessmentSchema = z.object({
  age: z.number().int().min(0).max(120),
  sex: z.string().min(1),
  primarySymptom: z.string().min(1),
  painLevel: z.number().int().min(0).max(10).optional(),
  durationHours: z.number().int().min(0).optional(),
  temperatureCelsius: z.number().min(30).max(45).optional(),
  additionalSymptoms: z.array(z.string()).default([]),
  medicalHistory: z.array(z.string()).default([]),
  currentMedications: z.array(z.string()).default([]),
  isPregnant: z.boolean().optional(),
  lifestyleFactors: z.array(z.string()).default([]),
});

export const updateAssessmentSchema = z.object({
  status: z.enum(["IN_PROGRESS", "AWAITING_REVIEW", "REVIEWED", "RESOLVED", "CANCELLED"]).optional(),
  clinicianNotes: z.string().optional(),
});

export const listAssessmentsQuerySchema = z.object({
  status: z.enum(["IN_PROGRESS", "AWAITING_REVIEW", "REVIEWED", "RESOLVED", "CANCELLED"]).optional(),
  urgency: z.enum(["EMERGENCY", "URGENT", "MODERATE", "ROUTINE"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  cursor: z.string().optional(),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;
