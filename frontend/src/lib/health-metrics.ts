/**
 * Mirrors backend/src/health/metric-types.ts — kept in sync manually since
 * the metric type whitelist isn't exposed over the API. Display-only; the
 * backend remains the source of truth for what's actually written.
 */
export const METRIC_LABELS: Record<string, string> = {
  HEART_RATE: "Heart rate",
  RESTING_HEART_RATE: "Resting heart rate",
  BLOOD_PRESSURE_SYSTOLIC: "Blood pressure (systolic)",
  BLOOD_PRESSURE_DIASTOLIC: "Blood pressure (diastolic)",
  SPO2: "Blood oxygen (SpO2)",
  TEMPERATURE_C: "Body temperature",
  STEPS: "Steps",
  SLEEP_MINUTES: "Sleep duration",
  ACTIVE_MINUTES: "Active minutes",
  WEIGHT_KG: "Weight",
};

export function metricLabel(metricType: string): string {
  return METRIC_LABELS[metricType] ?? metricType;
}
