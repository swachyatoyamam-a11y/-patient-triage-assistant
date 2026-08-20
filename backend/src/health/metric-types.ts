/**
 * App-level whitelist for HealthMetric.metricType — same pattern as
 * KNOWN_TAGS in ai/rules/symptom-tags.ts. A plain string column (not a DB
 * enum) so a new metric type can ship without a migration; this constant
 * is what actually constrains what gets written.
 */
export const HEALTH_METRIC_TYPES = [
  "HEART_RATE",
  "RESTING_HEART_RATE",
  "BLOOD_PRESSURE_SYSTOLIC",
  "BLOOD_PRESSURE_DIASTOLIC",
  "SPO2",
  "TEMPERATURE_C",
  "STEPS",
  "SLEEP_MINUTES",
  "ACTIVE_MINUTES",
  "WEIGHT_KG",
] as const;

export type HealthMetricType = (typeof HEALTH_METRIC_TYPES)[number];

export const METRIC_UNITS: Record<HealthMetricType, string> = {
  HEART_RATE: "bpm",
  RESTING_HEART_RATE: "bpm",
  BLOOD_PRESSURE_SYSTOLIC: "mmHg",
  BLOOD_PRESSURE_DIASTOLIC: "mmHg",
  SPO2: "%",
  TEMPERATURE_C: "°C",
  STEPS: "count",
  SLEEP_MINUTES: "minutes",
  ACTIVE_MINUTES: "minutes",
  WEIGHT_KG: "kg",
};

export const METRIC_LABELS: Record<HealthMetricType, string> = {
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
