import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { evaluateRules } from "@/ai/rules/rule-engine";
import { auditService } from "@/services/audit.service";

export const ruleEngineService = {
  /**
   * Runs the deterministic rule engine against an assessment and applies
   * the result. If the highest matched urgency is EMERGENCY, this builds
   * and saves a Recommendation itself — sourced entirely from the rule,
   * with no AI call — and reports that to the caller as `shortCircuited:
   * true` so the assessment controller skips the AI layer entirely for
   * confirmed emergencies. Anything less severe (or no match at all)
   * leaves the assessment for the AI layer to analyze next, with
   * `floorUrgency` passed along so the AI's result can never be
   * downgraded below what a rule already confirmed.
   */
  async evaluateAndApply(assessmentId: string) {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { symptoms: true },
    });
    if (!assessment) throw ApiError.notFound("Assessment not found");

    const { matchedRules, highestUrgency } = await evaluateRules(assessment);

    if (matchedRules.length > 0) {
      await prisma.$transaction(
        matchedRules.map((rule) =>
          prisma.ruleTrigger.create({ data: { assessmentId, ruleId: rule.id } })
        )
      );

      await auditService.log({
        action: "RULE_ENGINE_MATCHED",
        assessmentId,
        metadata: {
          matchedRuleIds: matchedRules.map((r) => r.id),
          highestUrgency,
        },
      });
    }

    if (highestUrgency === "EMERGENCY") {
      const ruleNames = matchedRules
        .filter((r) => r.resultingUrgency === "EMERGENCY")
        .map((r) => r.name);

      await prisma.$transaction(async (tx) => {
        // upsert, not create: re-running the rule engine (manual
        // "Re-analyze") targets an assessment that may already have a
        // Recommendation row (e.g. from import, or an earlier analysis) —
        // Recommendation.assessmentId is unique, so a bare create() would
        // fail on every second run.
        const data = {
          likelyConditions: [],
          confidenceScore: 1,
          recommendedDept: "Emergency Department",
          nextSteps: ["Immediate clinician evaluation required"],
          riskFactors: [],
          redFlagSymptoms: ruleNames,
          homeCareAdvice: null,
          explanation:
            `Routed directly to Emergency by deterministic rule match, without ` +
            `waiting on AI analysis: ${ruleNames.join("; ")}. This bypass exists ` +
            `specifically so confirmed emergencies are never delayed by an LLM round trip.`,
          modelName: "rule-engine-v1",
        };
        await tx.recommendation.upsert({
          where: { assessmentId },
          create: { assessmentId, ...data },
          update: data,
        });

        await tx.assessment.update({
          where: { id: assessmentId },
          data: { urgencyLevel: "EMERGENCY", status: "AWAITING_REVIEW" },
        });
      });

      return { shortCircuited: true as const, highestUrgency, matchedRules };
    }

    return { shortCircuited: false as const, highestUrgency, matchedRules };
  },
};
