import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Assessment, Rule, Symptom } from "@prisma/client";

// Mock the Prisma client before importing anything that uses it, since
// evaluateRules calls prisma.rule.findMany directly.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rule: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { evaluateRules } from "@/ai/rules/rule-engine";

type Fixture = Assessment & { symptoms: Symptom[] };

function buildAssessment(intake: Record<string, unknown>): Fixture {
  return { id: "a1", intake, symptoms: [] } as unknown as Fixture;
}

function buildRule(overrides: Partial<Rule>): Rule {
  return {
    id: overrides.id ?? "rule-1",
    name: overrides.name ?? "Test rule",
    description: overrides.description ?? "",
    condition: overrides.condition ?? {},
    resultingUrgency: overrides.resultingUrgency ?? "URGENT",
    isActive: true,
    createdById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Rule;
}

// Mirrors the five rules actually seeded in prisma/seed.ts — if these
// diverge, the seed data and this test should be updated together.
const SEEDED_RULES: Rule[] = [
  buildRule({
    id: "r-chest",
    name: "Chest pain with sweating",
    condition: { allOf: ["chest_pain", "sweating"] },
    resultingUrgency: "EMERGENCY",
  }),
  buildRule({
    id: "r-breathing",
    name: "Difficulty breathing",
    condition: { anyOf: ["difficulty_breathing", "shortness_of_breath"] },
    resultingUrgency: "EMERGENCY",
  }),
  buildRule({
    id: "r-head",
    name: "Head injury",
    condition: { anyOf: ["head_injury"] },
    resultingUrgency: "EMERGENCY",
  }),
  buildRule({
    id: "r-fever-infant",
    name: "High fever in an infant",
    condition: { allOf: ["high_fever"], ageUnder: 1 },
    resultingUrgency: "URGENT",
  }),
  buildRule({
    id: "r-cold",
    name: "Minor cold symptoms",
    condition: { allOf: ["minor_cold_symptoms"] },
    resultingUrgency: "ROUTINE",
  }),
];

describe("evaluateRules (integration, mocked Prisma)", () => {
  beforeEach(() => {
    vi.mocked(prisma.rule.findMany).mockResolvedValue(SEEDED_RULES);
  });

  it("matches the chest-pain-with-sweating emergency rule", async () => {
    const assessment = buildAssessment({ age: 50, primarySymptom: "chest pain and sweating" });
    const result = await evaluateRules(assessment);
    expect(result.highestUrgency).toBe("EMERGENCY");
    expect(result.matchedRules.map((r) => r.id)).toContain("r-chest");
  });

  it("does NOT match chest pain alone without sweating (allOf requires both)", async () => {
    const assessment = buildAssessment({ age: 50, primarySymptom: "chest pain" });
    const result = await evaluateRules(assessment);
    expect(result.matchedRules.map((r) => r.id)).not.toContain("r-chest");
  });

  it("matches high fever in an infant but not in an adult", async () => {
    const infant = buildAssessment({ age: 0, primarySymptom: "fussy", temperatureCelsius: 39.8 });
    const infantResult = await evaluateRules(infant);
    expect(infantResult.highestUrgency).toBe("URGENT");
    expect(infantResult.matchedRules.map((r) => r.id)).toContain("r-fever-infant");

    const adult = buildAssessment({ age: 40, primarySymptom: "tired", temperatureCelsius: 39.8 });
    const adultResult = await evaluateRules(adult);
    expect(adultResult.matchedRules.map((r) => r.id)).not.toContain("r-fever-infant");
  });

  it("takes the single most severe result when multiple rules match", async () => {
    // Head injury (EMERGENCY) + minor cold symptoms (ROUTINE) reported
    // together — EMERGENCY must win, and BOTH should still be recorded
    // as matches for the clinician reviewing the case.
    const assessment = buildAssessment({
      age: 30,
      primarySymptom: "hit my head, also runny nose",
    });
    const result = await evaluateRules(assessment);
    expect(result.highestUrgency).toBe("EMERGENCY");
    expect(result.matchedRules.map((r) => r.id).sort()).toEqual(["r-cold", "r-head"]);
  });

  it("returns null highestUrgency and no matches for an assessment with no red flags", async () => {
    const assessment = buildAssessment({ age: 30, primarySymptom: "mild wrist soreness" });
    const result = await evaluateRules(assessment);
    expect(result.highestUrgency).toBeNull();
    expect(result.matchedRules).toHaveLength(0);
  });

  it("only evaluates rules the mock marks active (isActive filter is passed to the query)", async () => {
    await evaluateRules(buildAssessment({ age: 30, primarySymptom: "chest pain" }));
    expect(prisma.rule.findMany).toHaveBeenCalledWith({ where: { isActive: true } });
  });
});
