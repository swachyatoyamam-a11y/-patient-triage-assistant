import type { Assessment, Symptom } from "@prisma/client";
import { aiRecommendationSchema } from "@/ai/engine/schema";

/**
 * The system prompt carries every hard constraint from the product spec:
 * never a diagnosis, always explain why, stay inside the JSON schema, and
 * defer upward (never downward) on urgency when uncertain — an AI that's
 * unsure should over-triage, not under-triage.
 */
export function buildSystemPrompt(): string {
  return `You are a clinical triage support system used by hospital intake staff.
Your job is to help PRIORITIZE patients, not to diagnose them.

Hard rules, no exceptions:
1. You never state or imply a confirmed diagnosis. "likelyConditions" are
   possibilities to consider, not conclusions — phrase them that way.
2. You always explain your reasoning in the "explanation" field, in plain
   language a nurse could sanity-check in under 15 seconds.
3. If the symptoms are ambiguous or you are uncertain, you choose the
   HIGHER urgency level, not the lower one. Under-triage is the failure
   mode that harms patients; over-triage costs staff time. Prefer the
   safer error.
4. You respond with ONLY a single JSON object matching the schema you were
   given. No markdown, no prose outside the JSON, no code fences.
5. You do not invent symptoms, history, or details the patient did not
   report. If information is missing, say so in "explanation" rather than
   assuming it.
6. "redFlagSymptoms" should list anything reported that a clinician would
   want to see flagged immediately, even if your overall urgency level is
   lower — this field is a safety net, not a summary of your top pick.

Remember: a licensed clinician reviews every recommendation before any
action is taken. Your output is an input to their judgment, not a
replacement for it.`;
}

type AssessmentWithSymptoms = Assessment & { symptoms: Symptom[] };

export function buildUserPrompt(assessment: AssessmentWithSymptoms): string {
  const intake = assessment.intake as Record<string, unknown>;

  const symptomLines =
    assessment.symptoms.length > 0
      ? assessment.symptoms
          .map(
            (s) =>
              `- ${s.name}${s.severity ? ` (severity ${s.severity}/10)` : ""}${
                s.durationHours ? `, ongoing ${s.durationHours}h` : ""
              }`
          )
          .join("\n")
      : "(none recorded as discrete symptom entries — see intake below)";

  const intakeLines = Object.entries(intake)
    .map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(", ") || "none" : String(value ?? "not provided")}`)
    .join("\n");

  return `Patient intake:
${intakeLines}

Reported symptoms:
${symptomLines}

Respond with ONLY a JSON object with exactly these keys:
${JSON.stringify(
  {
    likelyConditions: [{ condition: "string", confidenceWeight: "0-1" }],
    urgencyLevel: "EMERGENCY | URGENT | MODERATE | ROUTINE",
    confidenceScore: "0-1",
    recommendedDept: "string",
    nextSteps: ["string"],
    riskFactors: ["string"],
    redFlagSymptoms: ["string"],
    homeCareAdvice: "string or null",
    explanation: "string, required, explain your reasoning",
  },
  null,
  2
)}`;
}

// Re-exported so callers only need one import for "the whole prompt contract".
export { aiRecommendationSchema };
