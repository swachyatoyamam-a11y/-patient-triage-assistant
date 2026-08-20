import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import type { Prisma } from "@prisma/client";

// Chronic conditions treated as materially raising a patient's baseline
// risk for the "high-risk patient" admin stat — a judgment call, not a
// clinical standard; kept as a plain list so it's easy to revisit.
const HIGH_RISK_CONDITIONS = ["Heart disease", "Previous stroke", "Kidney disease", "Liver disease", "Diabetes"];

// Same abnormal-vitals thresholds already used client-side in the clinical
// assessment detail page's VitalTile (heart rate 60-100, BP systolic
// 90-140, temp 36.1-37.8°C, SpO2 >= 95%) — kept in sync manually.
const ABNORMAL_VITALS_WHERE: Prisma.VitalsWhereInput = {
  OR: [
    { heartRate: { lt: 60 } },
    { heartRate: { gt: 100 } },
    { bloodPressureSystolic: { lt: 90 } },
    { bloodPressureSystolic: { gt: 140 } },
    { temperatureCelsius: { lt: 36.1 } },
    { temperatureCelsius: { gt: 37.8 } },
    { oxygenSaturation: { lt: 95 } },
  ],
};

/**
 * Aggregate stats for the admin dashboard. Kept as plain grouped counts for
 * now — swap for a materialized view if this gets slow at scale.
 */
export const analyticsService = {
  async summary() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [patientsToday, emergencyCases, urgencyBreakdown, avgWaitRows] = await Promise.all([
      prisma.assessment.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.assessment.count({
        where: { urgencyLevel: "EMERGENCY", createdAt: { gte: startOfDay } },
      }),
      prisma.assessment.groupBy({
        by: ["urgencyLevel"],
        _count: true,
        where: { createdAt: { gte: startOfDay } },
      }),
      prisma.$queryRaw<{ avg_minutes: number | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("reviewedAt" - "createdAt")) / 60) AS avg_minutes
        FROM "Assessment"
        WHERE "reviewedAt" IS NOT NULL AND "createdAt" >= ${startOfDay}
      `,
    ]);

    return {
      patientsToday,
      emergencyCases,
      urgencyBreakdown,
      averageWaitMinutes: avgWaitRows[0]?.avg_minutes ?? null,
    };
  },

  async commonSymptoms(limit = 10) {
    const rows = await prisma.symptom.groupBy({
      by: ["name"],
      _count: true,
      orderBy: { _count: { name: "desc" } },
      take: limit,
    });
    return rows.map((r) => ({ symptom: r.name, count: r._count }));
  },

  /** Extended system/AI/patient stats for the admin dashboard's second row. */
  async extendedSummary() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600_000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 3600_000);

    const [
      newPatientsThisWeek,
      newPatientsThisMonth,
      activePatientIds,
      reviewPatientIds,
      recommendationStats,
      clinicianOverrideCount,
      aiErrorCount,
      avgProcessingRows,
      commonConditionsRaw,
      abnormalVitalsCount,
      highRiskConditionPatientIds,
      volumeRows,
    ] = await Promise.all([
      prisma.patient.count({ where: { user: { createdAt: { gte: sevenDaysAgo } } } }),
      prisma.patient.count({ where: { user: { createdAt: { gte: thirtyDaysAgo } } } }),
      prisma.assessment.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { patientId: true },
        distinct: ["patientId"],
      }),
      prisma.assessment.findMany({
        where: { status: "AWAITING_REVIEW" },
        select: { patientId: true },
        distinct: ["patientId"],
      }),
      prisma.recommendation.aggregate({
        _count: true,
      }),
      prisma.auditLog.count({ where: { action: "URGENCY_OVERRIDDEN" } }),
      prisma.auditLog.count({ where: { action: "AI_ANALYSIS_FAILED" } }),
      prisma.$queryRaw<{ avg_minutes: number | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM (r."createdAt" - a."createdAt")) / 60) AS avg_minutes
        FROM "Recommendation" r
        JOIN "Assessment" a ON a.id = r."assessmentId"
      `,
      prisma.medicalCondition.groupBy({
        by: ["name"],
        _count: true,
        where: { status: "ACTIVE" },
        orderBy: { _count: { name: "desc" } },
        take: 8,
      }),
      prisma.vitals.count({ where: ABNORMAL_VITALS_WHERE }),
      prisma.medicalCondition.findMany({
        where: { status: "ACTIVE", name: { in: HIGH_RISK_CONDITIONS } },
        select: { patientId: true },
        distinct: ["patientId"],
      }),
      prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "Assessment"
        WHERE "createdAt" >= ${fourteenDaysAgo}
        GROUP BY day
        ORDER BY day ASC
      `,
    ]);

    const escalatedCount = await prisma.recommendation.count({ where: { wasEscalatedByAi: true } });
    const totalRecommendations = recommendationStats._count;
    const aiEscalationRate = totalRecommendations > 0 ? (escalatedCount / totalRecommendations) * 100 : 0;

    // High-risk = has a high-risk condition on file AND had a recent
    // EMERGENCY/URGENT assessment — a condition alone isn't "high risk
    // right now", and an urgent assessment alone doesn't factor in history.
    const highRiskConditionIds = new Set(highRiskConditionPatientIds.map((p) => p.patientId));
    let highRiskPatientCount = 0;
    if (highRiskConditionIds.size > 0) {
      const recentSeverePatients = await prisma.assessment.findMany({
        where: {
          patientId: { in: Array.from(highRiskConditionIds) },
          urgencyLevel: { in: ["EMERGENCY", "URGENT"] },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { patientId: true },
        distinct: ["patientId"],
      });
      highRiskPatientCount = recentSeverePatients.length;
    }

    return {
      newPatientsThisWeek,
      newPatientsThisMonth,
      activePatientCount: activePatientIds.length,
      patientsRequiringReview: reviewPatientIds.length,
      aiEscalationRate,
      clinicianOverrideCount,
      aiErrorCount,
      averageProcessingMinutes: avgProcessingRows[0]?.avg_minutes ?? null,
      commonConditions: commonConditionsRaw.map((c) => ({ condition: c.name, count: c._count })),
      abnormalVitalsCount,
      highRiskPatientCount,
      assessmentVolumeOverTime: volumeRows.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: Number(r.count) })),
    };
  },

  /** Full aggregation for the admin/clinical patient detail view — one call
   * instead of the frontend making several. */
  async patientDetail(patientId: string) {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        medicalConditions: { orderBy: { createdAt: "desc" } },
        allergies: { orderBy: { createdAt: "desc" } },
        medications: { orderBy: { createdAt: "desc" } },
        surgeries: { orderBy: { createdAt: "desc" } },
        healthConnections: {
          select: {
            id: true,
            provider: true,
            status: true,
            lastSyncedAt: true,
            connectedAt: true,
            disconnectedAt: true,
          },
        },
      },
    });
    if (!patient) throw ApiError.notFound("Patient not found");

    const [assessments, recentMetrics, auditLogs] = await Promise.all([
      prisma.assessment.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { recommendation: true, vitals: true },
      }),
      prisma.healthMetric.findMany({
        where: { patientId },
        orderBy: { recordedAt: "desc" },
        take: 50,
      }),
      prisma.auditLog.findMany({
        where: {
          OR: [{ userId: patient.userId }, { assessment: { patientId } }],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { email: true, role: true } } },
      }),
    ]);

    return { patient, assessments, recentMetrics, auditLogs };
  },
};
