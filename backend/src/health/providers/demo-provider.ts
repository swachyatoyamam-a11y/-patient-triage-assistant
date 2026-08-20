import type { HealthConnection } from "@prisma/client";
import type { HealthDataProvider, NormalizedMetric } from "@/health/provider.interface";
import { METRIC_UNITS, type HealthMetricType } from "@/health/metric-types";

/**
 * Fully real code, not a mock of a real integration — generates obviously
 * synthetic readings so the whole pipeline (connect → sync → store → chart
 * → feed into AI context) is demonstrable with zero external dependencies.
 * Every value is deterministic per-patient (seeded on patientId) rather
 * than fresh-random on every call, so repeated syncs look like a plausible
 * timeline instead of jumping around randomly. Every row is tagged
 * metadata:{synthetic:true} so it can never be mistaken for a real reading.
 */

// Small deterministic PRNG (mulberry32) seeded from a string — no crypto
// needed here, this is demo data generation, not anything security-sensitive.
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function randomInRange(rand: () => number, min: number, max: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round((min + rand() * (max - min)) * factor) / factor;
}

// Whole-number metrics (steps, minutes) look wrong with a decimal; vitals
// like heart rate/weight read naturally with one.
const WHOLE_NUMBER_METRICS = new Set<HealthMetricType>(["STEPS", "SLEEP_MINUTES", "ACTIVE_MINUTES"]);

const DEMO_METRIC_RANGES: Partial<Record<HealthMetricType, [number, number]>> = {
  HEART_RATE: [62, 88],
  RESTING_HEART_RATE: [55, 68],
  SPO2: [96, 99],
  STEPS: [3000, 11000],
  SLEEP_MINUTES: [360, 480],
  ACTIVE_MINUTES: [15, 60],
  WEIGHT_KG: [60, 85],
};

export const demoProvider: HealthDataProvider = {
  id: "DEMO",
  label: "Demo Health Data",

  isConfigured() {
    return true; // no external dependency — always available
  },

  async fetchMetrics(connection: HealthConnection): Promise<NormalizedMetric[]> {
    const rand = seededRandom(`${connection.patientId}:${new Date().toDateString()}`);
    const now = new Date();

    return (Object.keys(DEMO_METRIC_RANGES) as HealthMetricType[]).map((metricType) => {
      const [min, max] = DEMO_METRIC_RANGES[metricType]!;
      return {
        metricType,
        value: randomInRange(rand, min, max, WHOLE_NUMBER_METRICS.has(metricType) ? 0 : 1),
        unit: METRIC_UNITS[metricType],
        recordedAt: now,
        metadata: { synthetic: true },
      };
    });
  },
};
