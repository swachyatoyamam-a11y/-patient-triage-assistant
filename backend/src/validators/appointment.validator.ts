import { z } from "zod";

export const createAppointmentSchema = z.object({
  doctorId: z.string().optional(),
  scheduledAt: z.coerce.date(),
  reason: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  scheduledAt: z.coerce.date().optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
