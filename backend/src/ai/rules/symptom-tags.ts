import type { Assessment, Symptom } from "@prisma/client";

/**
 * Keyword → tag map. Deliberately plain substring matching, not an NLP
 * model — the whole point of the rule engine is that it works even when
 * the AI provider is down or misbehaving, so it must not depend on one.
 *
 * Tags here must match what Rule.condition clauses reference (see
 * prisma/seed.ts for the shipped rules). Adding a new red-flag rule from
 * the admin UI that references a tag not covered here is a real gap —
 * worth a "known tags" reference view in the admin UI in Phase 7.
 */
const KEYWORD_TAGS: Record<string, string[]> = {
  chest_pain: ["chest pain", "chest tightness", "pain in my chest", "chest pressure"],
  sweating: ["sweating", "diaphoresis", "sweaty", "night sweats"],
  difficulty_breathing: [
    "difficulty breathing",
    "can't breathe",
    "cant breathe",
    "trouble breathing",
    "gasping",
  ],
  shortness_of_breath: ["shortness of breath", "short of breath", "breathless", "winded"],
  head_injury: [
    "head injury",
    "hit my head",
    "head trauma",
    "concussion",
    "fell and hit",
    "blow to the head",
  ],
  minor_cold_symptoms: [
    "runny nose",
    "sore throat",
    "mild cough",
    "common cold",
    "stuffy nose",
    "cold symptoms",
    "sneezing",
  ],
  severe_bleeding: ["severe bleeding", "won't stop bleeding", "heavy bleeding"],
  loss_of_consciousness: ["passed out", "lost consciousness", "fainted", "blacked out"],
  severe_abdominal_pain: ["severe abdominal pain", "excruciating stomach pain"],
};

/** Tags derived from structured fields rather than keyword matching. */
const STRUCTURED_TAGS = ["high_fever", "pregnant"];

/** Every tag this engine can ever produce — used to validate that a rule
 * written in the admin UI doesn't reference a tag that will never fire. */
export const KNOWN_TAGS = [...Object.keys(KEYWORD_TAGS), ...STRUCTURED_TAGS];

function textMatchesTag(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

type AssessmentWithSymptoms = Assessment & { symptoms: Symptom[] };

/**
 * Pulls every piece of free text the patient entered — primary symptom,
 * additional symptoms, discrete Symptom rows, notes — and returns the set
 * of tags found, plus tags derived from structured fields (temperature,
 * pregnancy) where a threshold is more reliable than keyword matching.
 */
export function normalizeSymptomTags(assessment: AssessmentWithSymptoms): Set<string> {
  const intake = assessment.intake as Record<string, unknown>;
  const tags = new Set<string>();

  const freeTextSources: string[] = [];
  if (typeof intake.primarySymptom === "string") freeTextSources.push(intake.primarySymptom);
  if (Array.isArray(intake.additionalSymptoms)) {
    freeTextSources.push(...intake.additionalSymptoms.filter((s): s is string => typeof s === "string"));
  }
  for (const symptom of assessment.symptoms) {
    freeTextSources.push(symptom.name);
    if (symptom.notes) freeTextSources.push(symptom.notes);
  }

  for (const text of freeTextSources) {
    for (const [tag, keywords] of Object.entries(KEYWORD_TAGS)) {
      if (textMatchesTag(text, keywords)) tags.add(tag);
    }
  }

  // Structured-field-derived tags — thresholds are more reliable here than
  // parsing "I have a fever" out of free text.
  const temperature = typeof intake.temperatureCelsius === "number" ? intake.temperatureCelsius : undefined;
  if (temperature !== undefined && temperature >= 39.4) {
    tags.add("high_fever");
  }
  if (intake.isPregnant === true) {
    tags.add("pregnant");
  }

  return tags;
}

/** Age is a required field in the intake schema — falls back to 0 only if
 * somehow missing, which age-based rules should treat conservatively. */
export function extractAge(assessment: AssessmentWithSymptoms): number {
  const intake = assessment.intake as Record<string, unknown>;
  return typeof intake.age === "number" ? intake.age : 0;
}
