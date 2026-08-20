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

/**
 * Physiologically plausible bounds per metric type — the API boundary for
 * ingested (and, where applicable, patient-entered) readings. Deliberately
 * explicit rather than inferred: a healthcare app must never guess at what
 * counts as a valid value. Heart rate / SpO2 / temperature / blood pressure
 * bounds mirror the same ranges already enforced on patient-entered vitals
 * in assessment.validator.ts, kept in sync manually for consistency.
 */
export const HEALTH_METRIC_RANGES: Record<HealthMetricType, { min: number; max: number }> = {
  HEART_RATE: { min: 20, max: 250 },
  RESTING_HEART_RATE: { min: 20, max: 250 },
  BLOOD_PRESSURE_SYSTOLIC: { min: 50, max: 250 },
  BLOOD_PRESSURE_DIASTOLIC: { min: 30, max: 150 },
  SPO2: { min: 50, max: 100 },
  TEMPERATURE_C: { min: 30, max: 45 },
  STEPS: { min: 0, max: 100_000 },
  SLEEP_MINUTES: { min: 0, max: 1440 },
  ACTIVE_MINUTES: { min: 0, max: 1440 },
  WEIGHT_KG: { min: 2, max: 500 },
};
