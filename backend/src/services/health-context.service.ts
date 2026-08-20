import { prisma } from "@/lib/prisma";
import { METRIC_LABELS, METRIC_UNITS, type HealthMetricType } from "@/health/metric-types";

export type HealthMetricContext = {
  metricType: string;
  label: string;
  value: number;
  unit: string;
  recordedAt: Date;
  source: string;
};

const DEFAULT_WITHIN_HOURS = 24;

/**
 * Latest reading per metric type, sourced ONLY from connections the patient
 * has explicitly authorized (status "CONNECTED"). A disconnected or
 * never-connected patient contributes nothing here — this is how "the
 * patient controls whether their external health data is available to the
 * assistant" is enforced structurally, not just by a UI toggle: revoking
 * a connection stops it from reaching the AI immediately, even though the
 * historical HealthMetric rows themselves are preserved for the timeline.
 */
export const healthContextService = {
  async getRecentHealthContext(
    patientId: string,
    { withinHours = DEFAULT_WITHIN_HOURS }: { withinHours?: number } = {}
  ): Promise<HealthMetricContext[]> {
    const connectedProviders = await prisma.healthConnection.findMany({
      where: { patientId, status: "CONNECTED" },
      select: { id: true },
    });
    if (connectedProviders.length === 0) return [];

    const connectionIds = connectedProviders.map((c) => c.id);
    const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);

    const metrics = await prisma.healthMetric.findMany({
      where: { patientId, connectionId: { in: connectionIds }, recordedAt: { gte: since } },
      orderBy: { recordedAt: "desc" },
    });

    // Keep only the most recent reading per metric type.
    const latestByType = new Map<string, (typeof metrics)[number]>();
    for (const m of metrics) {
      if (!latestByType.has(m.metricType)) latestByType.set(m.metricType, m);
    }

    return Array.from(latestByType.values()).map((m) => ({
      metricType: m.metricType,
      label: METRIC_LABELS[m.metricType as HealthMetricType] ?? m.metricType,
      value: m.value,
      unit: m.unit || METRIC_UNITS[m.metricType as HealthMetricType] || "",
      recordedAt: m.recordedAt,
      source: m.source,
    }));
  },
};
