import { z } from "zod";
import { HEALTH_METRIC_TYPES, HEALTH_METRIC_RANGES, METRIC_UNITS } from "@/health/metric-types";

export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1, "Missing authorization code"),
  state: z.string().min(1, "Missing state"),
});

export const metricsQuerySchema = z.object({
  type: z.enum(HEALTH_METRIC_TYPES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// Maximum readings accepted in a single ingest call — a defensive bound on
// payload size, not a claim about what a real sync batch should look like.
const MAX_READINGS_PER_INGEST = 500;

/**
 * One normalized reading from a native companion app (HealthKit / Health
 * Connect). Every field is validated at this boundary rather than trusted
 * — this is a healthcare app, so a metric type this app doesn't know about,
 * a unit that doesn't match that metric type, or a value outside a
 * physiologically plausible range is rejected outright, never coerced or
 * guessed at.
 */
const healthReadingSchema = z
  .object({
    metricType: z.enum(HEALTH_METRIC_TYPES, {
      errorMap: () => ({ message: "Unrecognized metric type — see HEALTH_METRIC_TYPES for the supported set." }),
    }),
    value: z.number().finite("value must be a finite number"),
    unit: z.string().min(1),
    // Native platforms record in UTC; reject anything that doesn't parse.
    recordedAt: z.coerce.date(),
    // The native platform's own per-sample id (HealthKit HKSample.uuid,
    // Health Connect record id) — used for idempotent re-submission.
    // Optional only because a caller technically could omit it, not
    // because it's expected to be: without it, retried submissions can
    // create duplicate rows.
    externalId: z.string().min(1).max(200).optional(),
  })
  .superRefine((reading, ctx) => {
    const range = HEALTH_METRIC_RANGES[reading.metricType];
    if (reading.value < range.min || reading.value > range.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: `${reading.metricType} must be between ${range.min} and ${range.max} — got ${reading.value}.`,
      });
    }

    const expectedUnit = METRIC_UNITS[reading.metricType];
    if (reading.unit !== expectedUnit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unit"],
        message: `${reading.metricType} must be reported in "${expectedUnit}" — got "${reading.unit}". This endpoint never converts units; convert on the client before sending.`,
      });
    }

    if (reading.recordedAt.getTime() > Date.now() + 60_000) {
      // Small grace window for clock skew between the device and server,
      // not a real allowance for future-dated readings.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recordedAt"],
        message: "recordedAt cannot be in the future.",
      });
    }
  });

export const healthIngestSchema = z.object({
  readings: z
    .array(healthReadingSchema)
    .min(1, "At least one reading is required.")
    .max(MAX_READINGS_PER_INGEST, `At most ${MAX_READINGS_PER_INGEST} readings per request.`),
});

export type HealthIngestInput = z.infer<typeof healthIngestSchema>;
