import { z } from "zod";

// Fixed condition list offered as checkboxes in the UI. "name" also accepts
// any other non-empty string (custom/"Other" free text) — this list exists
// for a consistent UI/analytics vocabulary, not as a hard enum, since a
// condition list that can't be extended by a patient defeats the point.
export const COMMON_CONDITIONS = [
  "Diabetes",
  "Hypertension",
  "Asthma",
  "Heart disease",
  "Thyroid disorders",
  "Kidney disease",
  "Liver disease",
  "High cholesterol",
  "Previous stroke",
] as const;

export const conditionSchema = z.object({
  name: z.string().min(1, "Condition name is required").max(200),
  status: z.enum(["ACTIVE", "RESOLVED"]).default("ACTIVE"),
  diagnosedAt: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
});
export const updateConditionSchema = conditionSchema.partial();

export const allergySchema = z.object({
  substance: z.string().min(1, "Substance is required").max(200),
  reaction: z.string().max(500).optional(),
  severity: z.enum(["mild", "moderate", "severe"]).optional(),
});
export const updateAllergySchema = allergySchema.partial();

export const medicationSchema = z.object({
  name: z.string().min(1, "Medication name is required").max(200),
  dosage: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  isActive: z.boolean().default(true),
  startedAt: z.coerce.date().optional(),
});
export const updateMedicationSchema = medicationSchema.partial();

export const surgerySchema = z.object({
  procedure: z.string().min(1, "Procedure is required").max(300),
  performedAt: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
});
export const updateSurgerySchema = surgerySchema.partial();

export const emergencyInfoSchema = z.object({
  bloodType: z.string().max(10).optional(),
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(50).optional(),
});

export type ConditionInput = z.infer<typeof conditionSchema>;
export type AllergyInput = z.infer<typeof allergySchema>;
export type MedicationInput = z.infer<typeof medicationSchema>;
export type SurgeryInput = z.infer<typeof surgerySchema>;
export type EmergencyInfoInput = z.infer<typeof emergencyInfoSchema>;
