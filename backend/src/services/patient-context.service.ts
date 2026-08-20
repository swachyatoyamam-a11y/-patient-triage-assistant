import { prisma } from "@/lib/prisma";

export type PatientProfileContext = {
  age: number;
  sex: string;
  conditions: { name: string; status: string }[];
  allergies: { substance: string; severity: string | null }[];
  medications: { name: string; dosage: string | null }[];
  surgeries: { procedure: string; performedAt: Date | null }[];
};

function calculateAge(dateOfBirth: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = now.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

/**
 * Assembles the patient's *persistent* profile — stored once via
 * Profile > Medical History (patient-profile.service.ts), not re-entered
 * per visit — for the AI layer to use as background context. Only ACTIVE
 * conditions and active medications are included; a resolved/discontinued
 * entry is history, not current context.
 */
export const patientContextService = {
  async getProfileContext(patientId: string): Promise<PatientProfileContext> {
    const [patient, conditions, allergies, medications, surgeries] = await Promise.all([
      prisma.patient.findUniqueOrThrow({ where: { id: patientId }, select: { dateOfBirth: true, sex: true } }),
      prisma.medicalCondition.findMany({
        where: { patientId, status: "ACTIVE" },
        select: { name: true, status: true },
      }),
      prisma.allergy.findMany({ where: { patientId }, select: { substance: true, severity: true } }),
      prisma.medication.findMany({
        where: { patientId, isActive: true },
        select: { name: true, dosage: true },
      }),
      prisma.surgery.findMany({ where: { patientId }, select: { procedure: true, performedAt: true } }),
    ]);

    return {
      age: calculateAge(patient.dateOfBirth),
      sex: patient.sex,
      conditions,
      allergies,
      medications,
      surgeries,
    };
  },
};
