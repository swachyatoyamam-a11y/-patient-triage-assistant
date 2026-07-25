import { z } from "zod";

/**
 * Every field the model is allowed to return. Nothing outside this shape
 * reaches the database or the clinician's screen — if the model's JSON
 * doesn't parse against this, `analyzeAssessment` treats it as a failure
 * and retries once rather than passing through unvalidated text.
 *
 * Constraints below aren't just typing — they're guardrails against the
 * specific ways a model tends to overreach in a clinical context:
 * - likelyConditions is capped and never called a "diagnosis"
 * - confidence fields are bounded [0,1], not a free-form "very confident"
 * - explanation is required — an urgency level with no stated reasoning
 *   is rejected outright, since "why" is a hard requirement, not a nicety
 */
export const aiRecommendationSchema = z.object({
  likelyConditions: z
    .array(
      z.object({
        condition: z.string().min(1).max(120),
        // Coerced rather than a strict z.number(): some providers (Gemini
        // observed in practice) return this as a quoted numeric string
        // despite the prompt asking for a bare number — coercion accepts
        // either without weakening the [0,1] bound (a non-numeric string
        // still fails as NaN).
        confidenceWeight: z.coerce.number().min(0).max(1),
      })
    )
    .max(5)
    .describe("Possible conditions to consider — never a confirmed diagnosis."),

  urgencyLevel: z.enum(["EMERGENCY", "URGENT", "MODERATE", "ROUTINE"]),

  confidenceScore: z.coerce.number().min(0).max(1),

  recommendedDept: z.string().min(1).max(80),

  nextSteps: z.array(z.string().min(1).max(200)).min(1).max(6),

  riskFactors: z.array(z.string().min(1).max(160)).max(10),

  redFlagSymptoms: z.array(z.string().min(1).max(160)).max(10),

  homeCareAdvice: z.string().max(600).nullable(),

  explanation: z
    .string()
    .min(20, "Explanation is required and must be substantive — not just a label")
    .max(1200),
});

export type AiRecommendation = z.infer<typeof aiRecommendationSchema>;
