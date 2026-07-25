import { describe, it, expect } from "vitest";
import { evaluateCondition } from "@/ai/rules/condition-evaluator";

describe("evaluateCondition", () => {
  it("matches when all allOf tags are present", () => {
    const result = evaluateCondition(
      { allOf: ["chest_pain", "sweating"] },
      { tags: new Set(["chest_pain", "sweating", "nausea"]), age: 45 }
    );
    expect(result).toBe(true);
  });

  it("does not match when only some allOf tags are present", () => {
    const result = evaluateCondition(
      { allOf: ["chest_pain", "sweating"] },
      { tags: new Set(["chest_pain"]), age: 45 }
    );
    expect(result).toBe(false);
  });

  it("matches when at least one anyOf tag is present", () => {
    const result = evaluateCondition(
      { anyOf: ["difficulty_breathing", "shortness_of_breath"] },
      { tags: new Set(["shortness_of_breath"]), age: 30 }
    );
    expect(result).toBe(true);
  });

  it("does not match when no anyOf tag is present", () => {
    const result = evaluateCondition(
      { anyOf: ["difficulty_breathing", "shortness_of_breath"] },
      { tags: new Set(["minor_cold_symptoms"]), age: 30 }
    );
    expect(result).toBe(false);
  });

  it("excludes matches when a noneOf tag is present", () => {
    const result = evaluateCondition(
      { allOf: ["high_fever"], noneOf: ["pregnant"] },
      { tags: new Set(["high_fever", "pregnant"]), age: 25 }
    );
    expect(result).toBe(false);
  });

  it("respects ageUnder as a strict less-than", () => {
    const condition = { allOf: ["high_fever"], ageUnder: 1 };
    expect(evaluateCondition(condition, { tags: new Set(["high_fever"]), age: 0 })).toBe(true);
    // Exactly 1 should NOT match — ageUnder is strict, this is the classic
    // off-by-one a clinical rule cannot afford to get wrong.
    expect(evaluateCondition(condition, { tags: new Set(["high_fever"]), age: 1 })).toBe(false);
    expect(evaluateCondition(condition, { tags: new Set(["high_fever"]), age: 2 })).toBe(false);
  });

  it("respects ageOver as a strict greater-than", () => {
    const condition = { anyOf: ["chest_pain"], ageOver: 65 };
    expect(evaluateCondition(condition, { tags: new Set(["chest_pain"]), age: 65 })).toBe(false);
    expect(evaluateCondition(condition, { tags: new Set(["chest_pain"]), age: 66 })).toBe(true);
  });

  it("combines allOf and age constraints with AND semantics", () => {
    const condition = { allOf: ["high_fever"], ageUnder: 1 };
    // Right symptom, wrong age — must not match.
    expect(evaluateCondition(condition, { tags: new Set(["high_fever"]), age: 30 })).toBe(false);
    // Right age, wrong symptom — must not match.
    expect(evaluateCondition(condition, { tags: new Set([]), age: 0 })).toBe(false);
  });

  it("matches an empty condition unconditionally (validator's job to reject these at write time)", () => {
    // Documents the deliberate behavior at the function level: this
    // function does no "is this condition meaningful" checking itself —
    // see rule.validator.ts's refine() for where that's actually enforced.
    expect(evaluateCondition({}, { tags: new Set(), age: 0 })).toBe(true);
  });
});
