import type { Assessment, Symptom } from "@prisma/client";
import { aiRecommendationSchema } from "@/ai/engine/schema";
import type { PatientProfileContext } from "@/services/patient-context.service";
import type { HealthMetricContext } from "@/services/health-context.service";

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
7. You may be given the patient's stored medical profile and/or recent
   connected health-device readings, each in its own clearly labeled
   section below. Treat both as background CONTEXT that informs your
   reasoning about the CURRENT symptoms — never as a substitute for them,
   and never as a reason to invent findings the patient didn't report this
   visit. If a section is absent, no such data was available; don't guess.

Remember: a licensed clinician reviews every recommendation before any
action is taken. Your output is an input to their judgment, not a
replacement for it.`;
}

type AssessmentWithSymptoms = Assessment & { symptoms: Symptom[] };

function buildProfileSection(profile?: PatientProfileContext): string {
  if (!profile) return "";
  const conditions = profile.conditions.length > 0 ? profile.conditions.map((c) => c.name).join(", ") : "none on record";
  const allergies =
    profile.allergies.length > 0
      ? profile.allergies.map((a) => (a.severity ? `${a.substance} (${a.severity})` : a.substance)).join(", ")
      : "none on record";
  const medications =
    profile.medications.length > 0
      ? profile.medications.map((m) => (m.dosage ? `${m.name} (${m.dosage})` : m.name)).join(", ")
      : "none on record";
  const surgeries = profile.surgeries.length > 0 ? profile.surgeries.map((s) => s.procedure).join(", ") : "none on record";

  return `\nPatient's stored medical profile (persistent, not entered this visit):
- Age: ${profile.age}
- Sex: ${profile.sex}
- Existing conditions: ${conditions}
- Allergies: ${allergies}
- Current medications: ${medications}
- Previous surgeries: ${surgeries}
`;
}

function buildHealthDataSection(metrics?: HealthMetricContext[]): string {
  if (!metrics || metrics.length === 0) return "";
  const lines = metrics
    .map((m) => `- ${m.label}: ${m.value} ${m.unit} (recorded ${m.recordedAt.toISOString()}, source: ${m.source})`)
    .join("\n");
  return `\nRecently connected health-device data (patient-authorized readings, most recent per metric):\n${lines}\n`;
}

export function buildUserPrompt(
  assessment: AssessmentWithSymptoms,
  profileContext?: PatientProfileContext,
  healthContext?: HealthMetricContext[]
): string {
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

  return `${buildProfileSection(profileContext)}${buildHealthDataSection(healthContext)}
Patient intake (this visit):
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
