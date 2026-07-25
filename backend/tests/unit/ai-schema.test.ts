import { describe, it, expect } from "vitest";
import { aiRecommendationSchema } from "@/ai/engine/schema";

const validBase = {
  likelyConditions: [{ condition: "Possible viral infection", confidenceWeight: 0.6 }],
  urgencyLevel: "MODERATE",
  confidenceScore: 0.7,
  recommendedDept: "Urgent Care",
  nextSteps: ["Monitor temperature", "Rest and fluids"],
  riskFactors: [],
  redFlagSymptoms: [],
  homeCareAdvice: "Stay hydrated and rest.",
  explanation:
    "Symptoms are consistent with a common viral illness with no reported red flags, so a lower urgency is appropriate.",
};

describe("aiRecommendationSchema", () => {
  it("accepts a well-formed recommendation", () => {
    expect(() => aiRecommendationSchema.parse(validBase)).not.toThrow();
  });

  it("rejects a confidence score outside [0,1] — no 'very confident' free text allowed", () => {
    expect(() => aiRecommendationSchema.parse({ ...validBase, confidenceScore: 1.5 })).toThrow();
    expect(() => aiRecommendationSchema.parse({ ...validBase, confidenceScore: -0.1 })).toThrow();
  });

  it("rejects an urgency level outside the fixed enum", () => {
    expect(() => aiRecommendationSchema.parse({ ...validBase, urgencyLevel: "SEVERE" })).toThrow();
  });

  it("rejects a missing or too-short explanation — a hard requirement, not a nicety", () => {
    expect(() => aiRecommendationSchema.parse({ ...validBase, explanation: "" })).toThrow();
    expect(() => aiRecommendationSchema.parse({ ...validBase, explanation: "fever" })).toThrow();
    const { explanation: _drop, ...withoutExplanation } = validBase;
    expect(() => aiRecommendationSchema.parse(withoutExplanation)).toThrow();
  });

  it("caps likelyConditions at 5 entries", () => {
    const tooMany = {
      ...validBase,
      likelyConditions: Array.from({ length: 6 }, (_, i) => ({
        condition: `Condition ${i}`,
        confidenceWeight: 0.1,
      })),
    };
    expect(() => aiRecommendationSchema.parse(tooMany)).toThrow();
  });

  it("requires at least one next step", () => {
    expect(() => aiRecommendationSchema.parse({ ...validBase, nextSteps: [] })).toThrow();
  });

  it("allows homeCareAdvice to be explicitly null but not omitted", () => {
    expect(() => aiRecommendationSchema.parse({ ...validBase, homeCareAdvice: null })).not.toThrow();
    const { homeCareAdvice: _drop, ...withoutAdvice } = validBase;
    expect(() => aiRecommendationSchema.parse(withoutAdvice)).toThrow();
  });

  it("rejects a confidenceWeight on a likely condition outside [0,1]", () => {
    const invalid = {
      ...validBase,
      likelyConditions: [{ condition: "X", confidenceWeight: 2 }],
    };
    expect(() => aiRecommendationSchema.parse(invalid)).toThrow();
  });
});
