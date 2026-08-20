import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { auditService } from "@/services/audit.service";
import type {
  ConditionInput,
  AllergyInput,
  MedicationInput,
  SurgeryInput,
  EmergencyInfoInput,
} from "@/validators/patient-profile.validator";

/**
 * Structured, persistent medical profile — read once here, then consumed
 * automatically by the assessment pipeline (see patient-context.service.ts)
 * instead of being re-typed by the patient on every visit. Every mutation
 * is scoped by patientId (never trusts a client-supplied id beyond the
 * authenticated user's own patient row) and audit-logged so profile
 * changes have a timestamped trail without needing a bespoke history table.
 */
async function requirePatientId(userId: string): Promise<string> {
  const patient = await prisma.patient.findUnique({ where: { userId } });
  if (!patient) throw ApiError.notFound("Patient profile not found");
  return patient.id;
}

function auditProfileChange(
  userId: string,
  resource: string,
  action: "created" | "updated" | "deleted",
  resourceId: string
) {
  return auditService.log({
    action: "MEDICAL_PROFILE_UPDATED",
    userId,
    metadata: { resource, resourceId, change: action },
  });
}

export const patientProfileService = {
  async getFullProfile(userId: string) {
    const patientId = await requirePatientId(userId);
    const [patient, conditions, allergies, medications, surgeries] = await Promise.all([
      prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
        select: {
          dateOfBirth: true,
          sex: true,
          bloodType: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
        },
      }),
      prisma.medicalCondition.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
      prisma.allergy.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
      prisma.medication.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
      prisma.surgery.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } }),
    ]);
    return { patient, conditions, allergies, medications, surgeries };
  },

  // --- Conditions ---------------------------------------------------------
  async addCondition(userId: string, input: ConditionInput) {
    const patientId = await requirePatientId(userId);
    const condition = await prisma.medicalCondition.create({ data: { patientId, ...input } });
    await auditProfileChange(userId, "condition", "created", condition.id);
    return condition;
  },
  async updateCondition(userId: string, id: string, input: Partial<ConditionInput>) {
    const patientId = await requirePatientId(userId);
    const existing = await prisma.medicalCondition.findUnique({ where: { id } });
    if (!existing || existing.patientId !== patientId) throw ApiError.notFound("Condition not found");
    const condition = await prisma.medicalCondition.update({ where: { id }, data: input });
    await auditProfileChange(userId, "condition", "updated", id);
    return condition;
  },
  async removeCondition(userId: string, id: string) {
    const patientId = await requirePatientId(userId);
    const existing = await prisma.medicalCondition.findUnique({ where: { id } });
    if (!existing || existing.patientId !== patientId) throw ApiError.notFound("Condition not found");
    await prisma.medicalCondition.delete({ where: { id } });
    await auditProfileChange(userId, "condition", "deleted", id);
  },

  // --- Allergies -----------------------------------------------------------
  async addAllergy(userId: string, input: AllergyInput) {
    const patientId = await requirePatientId(userId);
    const allergy = await prisma.allergy.create({ data: { patientId, ...input } });
    await auditProfileChange(userId, "allergy", "created", allergy.id);
    return allergy;
  },
  async updateAllergy(userId: string, id: string, input: Partial<AllergyInput>) {
    const patientId = await requirePatientId(userId);
    const existing = await prisma.allergy.findUnique({ where: { id } });
    if (!existing || existing.patientId !== patientId) throw ApiError.notFound("Allergy not found");
    const allergy = await prisma.allergy.update({ where: { id }, data: input });
    await auditProfileChange(userId, "allergy", "updated", id);
    return allergy;
  },
  async removeAllergy(userId: string, id: string) {
    const patientId = await requirePatientId(userId);
    const existing = await prisma.allergy.findUnique({ where: { id } });
    if (!existing || existing.patientId !== patientId) throw ApiError.notFound("Allergy not found");
    await prisma.allergy.delete({ where: { id } });
    await auditProfileChange(userId, "allergy", "deleted", id);
  },

  // --- Medications ---------------------------------------------------------
  async addMedication(userId: string, input: MedicationInput) {
    const patientId = await requirePatientId(userId);
    const medication = await prisma.medication.create({ data: { patientId, ...input } });
    await auditProfileChange(userId, "medication", "created", medication.id);
    return medication;
  },
  async updateMedication(userId: string, id: string, input: Partial<MedicationInput>) {
    const patientId = await requirePatientId(userId);
    const existing = await prisma.medication.findUnique({ where: { id } });
    if (!existing || existing.patientId !== patientId) throw ApiError.notFound("Medication not found");
    const medication = await prisma.medication.update({ where: { id }, data: input });
    await auditProfileChange(userId, "medication", "updated", id);
    return medication;
  },
  async removeMedication(userId: string, id: string) {
    const patientId = await requirePatientId(userId);
    const existing = await prisma.medication.findUnique({ where: { id } });
    if (!existing || existing.patientId !== patientId) throw ApiError.notFound("Medication not found");
    await prisma.medication.delete({ where: { id } });
    await auditProfileChange(userId, "medication", "deleted", id);
  },

  // --- Surgeries -----------------------------------------------------------
  async addSurgery(userId: string, input: SurgeryInput) {
    const patientId = await requirePatientId(userId);
    const surgery = await prisma.surgery.create({ data: { patientId, ...input } });
    await auditProfileChange(userId, "surgery", "created", surgery.id);
    return surgery;
  },
  async updateSurgery(userId: string, id: string, input: Partial<SurgeryInput>) {
    const patientId = await requirePatientId(userId);
    const existing = await prisma.surgery.findUnique({ where: { id } });
    if (!existing || existing.patientId !== patientId) throw ApiError.notFound("Surgery not found");
    const surgery = await prisma.surgery.update({ where: { id }, data: input });
    await auditProfileChange(userId, "surgery", "updated", id);
    return surgery;
  },
  async removeSurgery(userId: string, id: string) {
    const patientId = await requirePatientId(userId);
    const existing = await prisma.surgery.findUnique({ where: { id } });
    if (!existing || existing.patientId !== patientId) throw ApiError.notFound("Surgery not found");
    await prisma.surgery.delete({ where: { id } });
    await auditProfileChange(userId, "surgery", "deleted", id);
  },

  // --- Emergency info (on Patient itself) -----------------------------------
  async updateEmergencyInfo(userId: string, input: EmergencyInfoInput) {
    const patientId = await requirePatientId(userId);
    const patient = await prisma.patient.update({ where: { id: patientId }, data: input });
    await auditProfileChange(userId, "emergency-info", "updated", patientId);
    return patient;
  },
};
