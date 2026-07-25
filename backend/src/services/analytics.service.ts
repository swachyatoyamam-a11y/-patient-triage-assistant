import { prisma } from "@/lib/prisma";

/**
 * Aggregate stats for the admin dashboard (Phase 7 wires these into charts).
 * Kept as plain grouped counts for now — swap for a materialized view if
 * this gets slow at scale.
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
};
