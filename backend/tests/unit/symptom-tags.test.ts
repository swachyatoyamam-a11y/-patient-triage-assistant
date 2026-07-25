import { describe, it, expect } from "vitest";
import { normalizeSymptomTags, extractAge, KNOWN_TAGS } from "@/ai/rules/symptom-tags";
import type { Assessment, Symptom } from "@prisma/client";

type Fixture = Assessment & { symptoms: Symptom[] };

function buildAssessment(intake: Record<string, unknown>, symptoms: Partial<Symptom>[] = []): Fixture {
  return {
    id: "test-assessment",
    intake,
    symptoms: symptoms as Symptom[],
  } as unknown as Fixture;
}

describe("normalizeSymptomTags", () => {
  it("tags chest pain and sweating from the primary symptom field", () => {
    const assessment = buildAssessment({ primarySymptom: "Severe chest pain and sweating" });
    const tags = normalizeSymptomTags(assessment);
    expect(tags.has("chest_pain")).toBe(true);
    expect(tags.has("sweating")).toBe(true);
  });

  it("tags from additionalSymptoms array entries", () => {
    const assessment = buildAssessment({
      primarySymptom: "headache",
      additionalSymptoms: ["difficulty breathing", "dizziness"],
    });
    const tags = normalizeSymptomTags(assessment);
    expect(tags.has("difficulty_breathing")).toBe(true);
  });

  it("tags from discrete Symptom rows (name and notes)", () => {
    const assessment = buildAssessment({ primarySymptom: "fatigue" }, [
      { name: "hit my head yesterday", notes: null },
    ]);
    const tags = normalizeSymptomTags(assessment);
    expect(tags.has("head_injury")).toBe(true);
  });

  it("is case-insensitive", () => {
    const assessment = buildAssessment({ primarySymptom: "CHEST PAIN" });
    expect(normalizeSymptomTags(assessment).has("chest_pain")).toBe(true);
  });

  it("derives high_fever from temperature threshold, not keyword matching", () => {
    const withFever = buildAssessment({ primarySymptom: "tired", temperatureCelsius: 39.6 });
    expect(normalizeSymptomTags(withFever).has("high_fever")).toBe(true);

    const withoutFever = buildAssessment({ primarySymptom: "tired", temperatureCelsius: 37.2 });
    expect(normalizeSymptomTags(withoutFever).has("high_fever")).toBe(false);
  });

  it("derives pregnant tag from the structured isPregnant field", () => {
    const assessment = buildAssessment({ primarySymptom: "cramping", isPregnant: true });
    expect(normalizeSymptomTags(assessment).has("pregnant")).toBe(true);
  });

  it("does not tag anything from unrelated free text", () => {
    const assessment = buildAssessment({ primarySymptom: "mild ankle sprain from running" });
    const tags = normalizeSymptomTags(assessment);
    expect(tags.size).toBe(0);
  });

  describe("documented limitation: substring matching misses real paraphrases", () => {
    it("misses a natural paraphrase of difficulty breathing", () => {
      // This is the exact gap flagged in symptom-tags.ts and backend/README.md:
      // a patient who phrases things differently than the keyword list will
      // not get tagged, even though a clinician reading this would recognize
      // it instantly. This test exists to make the gap visible in CI, not to
      // assert desired behavior — if this test starts failing (i.e. tagging
      // starts working), update KEYWORD_TAGS and this test together.
      const assessment = buildAssessment({ primarySymptom: "I can't seem to get a full breath in" });
      const tags = normalizeSymptomTags(assessment);
      expect(tags.has("difficulty_breathing")).toBe(false);
    });
  });
});

describe("extractAge", () => {
  it("reads age from intake when present", () => {
    expect(extractAge(buildAssessment({ age: 34 }))).toBe(34);
  });

  it("falls back to 0 when age is missing or malformed", () => {
    expect(extractAge(buildAssessment({}))).toBe(0);
    expect(extractAge(buildAssessment({ age: "not a number" }))).toBe(0);
  });
});

describe("KNOWN_TAGS", () => {
  it("includes every tag referenced by the seeded rules", () => {
    const seedTags = [
      "chest_pain",
      "sweating",
      "difficulty_breathing",
      "shortness_of_breath",
      "head_injury",
      "high_fever",
      "minor_cold_symptoms",
    ];
    for (const tag of seedTags) {
      expect(KNOWN_TAGS).toContain(tag);
    }
  });
});
