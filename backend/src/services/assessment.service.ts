import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { auditService } from "@/services/audit.service";
import { URGENCY_SEVERITY } from "@/utils/urgency";
import type { CreateAssessmentInput, UpdateAssessmentInput } from "@/validators/assessment.validator";

export const assessmentService = {
  /**
   * Creates an assessment from structured intake. Does NOT run the rule
   * engine or AI analysis — the controller runs both right after this,
   * in that order (rule engine first, since a confirmed red flag should
   * short-circuit and never wait on an LLM round trip). Kept separate so intake
   * can be saved even if the analysis step is slow or briefly unavailable.
   */
  async create(patientId: string, intake: CreateAssessmentInput) {
    const assessment = await prisma.assessment.create({
      data: {
        patientId,
        intake,
        status: "IN_PROGRESS",
        vitals: {
          create: {
            heartRate: intake.heartRate,
            bloodPressureSystolic: intake.bloodPressureSystolic,
            bloodPressureDiastolic: intake.bloodPressureDiastolic,
            temperatureCelsius: intake.temperatureCelsius,
            oxygenSaturation: intake.oxygenSaturation,
          },
        },
      },
    });

    await auditService.log({
      action: "ASSESSMENT_CREATED",
      assessmentId: assessment.id,
      metadata: { primarySymptom: intake.primarySymptom },
    });

    return assessment;
  },

  async getById(id: string) {
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        symptoms: true,
        recommendation: true,
        vitals: true,
        ruleTriggers: { include: { rule: true } },
        patient: { include: { user: true } },
      },
    });
    if (!assessment) throw ApiError.notFound("Assessment not found");
    return assessment;
  },

  /** Clinical queue listing — sorted so EMERGENCY/URGENT always float up. */
  async list(filters: { status?: string; urgency?: string; limit: number; cursor?: string }) {
    const assessments = await prisma.assessment.findMany({
      where: {
        ...(filters.status && { status: filters.status as never }),
        ...(filters.urgency && { urgencyLevel: filters.urgency as never }),
      },
      take: filters.limit,
      ...(filters.cursor && { cursor: { id: filters.cursor }, skip: 1 }),
      orderBy: { createdAt: "desc" },
      include: { patient: { include: { user: true } }, recommendation: true, vitals: true },
    });

    return assessments.sort((a, b) => {
      const aRank = a.urgencyLevel ? URGENCY_SEVERITY[a.urgencyLevel] : 99;
      const bRank = b.urgencyLevel ? URGENCY_SEVERITY[b.urgencyLevel] : 99;
      return aRank - bRank;
    });
  },

  async update(id: string, reviewerId: string, input: UpdateAssessmentInput) {
    const existing = await prisma.assessment.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Assessment not found");

    const updated = await prisma.assessment.update({
      where: { id },
      data: {
        ...input,
        ...(input.status === "REVIEWED" && {
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        }),
      },
    });

    await auditService.log({
      action: "ASSESSMENT_UPDATED",
      assessmentId: id,
      userId: reviewerId,
      metadata: { status: input.status },
    });

    return updated;
  },
};
