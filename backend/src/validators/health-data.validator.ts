import { z } from "zod";
import { HEALTH_METRIC_TYPES } from "@/health/metric-types";

export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1, "Missing authorization code"),
  state: z.string().min(1, "Missing state"),
});

export const metricsQuerySchema = z.object({
  type: z.enum(HEALTH_METRIC_TYPES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
