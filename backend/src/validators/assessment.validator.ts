import { z } from "zod";

// Structured intake — mirrors the conversational questions from the
// symptom-checker UI (Phase 5 AI layer reads this shape). Temperature is
// mandatory; heartRate/oxygenSaturation/blood pressure are optional (a
// patient may not have a way to check them at home) but are range-validated
// whenever provided.
export const createAssessmentSchema = z
  .object({
    age: z.number().int().min(0).max(120),
    sex: z.string().min(1),
    primarySymptom: z.string().min(1),
    painLevel: z.number().int().min(0).max(10).optional(),
    durationHours: z.number().int().min(0).optional(),
    temperatureCelsius: z
      .number()
      .min(30, "Please enter a valid human body temperature between 30°C and 45°C.")
      .max(45, "Please enter a valid human body temperature between 30°C and 45°C."),
    heartRate: z
      .number()
      .min(20, "Please enter a valid pulse rate between 20 and 250 bpm.")
      .max(250, "Please enter a valid pulse rate between 20 and 250 bpm.")
      .optional(),
    oxygenSaturation: z
      .number()
      .min(50, "Please enter a valid SpO2 between 50% and 100%.")
      .max(100, "Please enter a valid SpO2 between 50% and 100%.")
      .optional(),
    bloodPressureSystolic: z
      .number()
      .min(50, "Please enter a valid systolic pressure between 50 and 250 mmHg.")
      .max(250, "Please enter a valid systolic pressure between 50 and 250 mmHg.")
      .optional(),
    bloodPressureDiastolic: z
      .number()
      .min(30, "Please enter a valid diastolic pressure between 30 and 150 mmHg.")
      .max(150, "Please enter a valid diastolic pressure between 30 and 150 mmHg.")
      .optional(),
    additionalSymptoms: z.array(z.string()).default([]),
    medicalHistory: z.array(z.string()).default([]),
    currentMedications: z.array(z.string()).default([]),
    isPregnant: z.boolean().optional(),
    lifestyleFactors: z.array(z.string()).default([]),
  })
  .refine(
    (data) =>
      data.bloodPressureSystolic === undefined ||
      data.bloodPressureDiastolic === undefined ||
      data.bloodPressureSystolic > data.bloodPressureDiastolic,
    {
      message: "Systolic pressure must be greater than diastolic pressure.",
      path: ["bloodPressureSystolic"],
    }
  );

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
