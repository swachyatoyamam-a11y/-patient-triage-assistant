import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRecommendationUpsert = vi.fn().mockResolvedValue({ id: "rec-1" });
const mockAssessmentUpdate = vi.fn().mockResolvedValue({});
const mockAssessmentFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    assessment: {
      findUnique: (...args: unknown[]) => mockAssessmentFindUnique(...args),
      update: (...args: unknown[]) => mockAssessmentUpdate(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        recommendation: { upsert: mockRecommendationUpsert },
        assessment: { update: mockAssessmentUpdate },
      }),
  },
}));

vi.mock("@/services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

const mockAnalyzeAssessment = vi.fn();
vi.mock("@/ai/engine/analyze-assessment", () => ({
  analyzeAssessment: (...args: unknown[]) => mockAnalyzeAssessment(...args),
}));

import { recommendationService } from "@/services/recommendation.service";

const AI_MODERATE_RESULT = {
  recommendation: {
    likelyConditions: [],
    urgencyLevel: "MODERATE" as const,
    confidenceScore: 0.5,
    recommendedDept: "Urgent Care",
    nextSteps: ["Monitor symptoms"],
    riskFactors: [],
    redFlagSymptoms: [],
    homeCareAdvice: null,
    explanation: "Symptoms are mild and consistent with a common cold.",
  },
  modelName: "claude-sonnet-5",
};

describe("recommendationService.generateFor — urgency floor enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssessmentFindUnique.mockResolvedValue({ id: "a1", symptoms: [] });
    mockAnalyzeAssessment.mockResolvedValue(AI_MODERATE_RESULT);
  });

  it("uses the AI's own urgency when no floor is given", async () => {
    await recommendationService.generateFor("a1");
    const updateCall = mockAssessmentUpdate.mock.calls[0][0];
    expect(updateCall.data.urgencyLevel).toBe("MODERATE");
  });

  it("uses the AI's own urgency when the floor is LESS severe", async () => {
    // Floor is ROUTINE, AI says MODERATE — MODERATE is more severe, wins either way.
    await recommendationService.generateFor("a1", "ROUTINE");
    const updateCall = mockAssessmentUpdate.mock.calls[0][0];
    expect(updateCall.data.urgencyLevel).toBe("MODERATE");
  });

  it("escalates to the floor when the rule-confirmed urgency is MORE severe than the AI's", async () => {
    // This is the actual safety property Phase 6 exists to guarantee:
    // a rule already found URGENT, but the AI under-called it as MODERATE —
    // the saved result must be URGENT, not MODERATE.
    await recommendationService.generateFor("a1", "URGENT");
    const updateCall = mockAssessmentUpdate.mock.calls[0][0];
    expect(updateCall.data.urgencyLevel).toBe("URGENT");

    const upsertCall = mockRecommendationUpsert.mock.calls[0][0];
    expect(upsertCall.create.explanation).toMatch(/raised from MODERATE to URGENT/);
    expect(upsertCall.update.explanation).toMatch(/raised from MODERATE to URGENT/);
  });

  it("never records EMERGENCY as a floor (that path short-circuits before this function runs)", async () => {
    // Not a runtime assertion the code enforces — this documents the
    // contract stated in the function's own doc comment, so a future
    // change that violates it fails a code review, not silently.
    await recommendationService.generateFor("a1", "EMERGENCY");
    const updateCall = mockAssessmentUpdate.mock.calls[0][0];
    // If callers ever DID pass EMERGENCY here, the floor logic would
    // still work correctly (EMERGENCY is most severe) — this just
    // confirms that's true, even though it shouldn't happen in practice.
    expect(updateCall.data.urgencyLevel).toBe("EMERGENCY");
  });
});
