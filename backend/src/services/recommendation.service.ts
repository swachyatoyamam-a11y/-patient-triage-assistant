import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { analyzeAssessment } from "@/ai/engine/analyze-assessment";
import { auditService } from "@/services/audit.service";
import { moreSevereUrgency } from "@/utils/urgency";
import type { UrgencyLevel } from "@prisma/client";

export const recommendationService = {
  /**
   * Runs AI analysis for an assessment and persists both the Recommendation
   * row and the assessment's urgencyLevel/status in one place, so they can
   * never drift out of sync.
   *
   * `floorUrgency`, if given, is the most severe level a rule engine match
   * already confirmed (see rule-engine.service.ts). The AI's own urgency
   * suggestion is compared against it and the MORE severe of the two wins —
   * an AI call can escalate a rule's finding but can never quietly walk
   * it back down. Callers only pass a non-EMERGENCY floor here, since an
   * EMERGENCY match short-circuits before this function is ever called.
   */
  async generateFor(assessmentId: string, floorUrgency?: UrgencyLevel | null) {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { symptoms: true },
    });
    if (!assessment) throw ApiError.notFound("Assessment not found");

    const { recommendation, modelName } = await analyzeAssessment(assessment);
    const finalUrgency =
      moreSevereUrgency(floorUrgency, recommendation.urgencyLevel) ?? recommendation.urgencyLevel;

    const explanation =
      finalUrgency !== recommendation.urgencyLevel
        ? `${recommendation.explanation}\n\n(Urgency raised from ${recommendation.urgencyLevel} to ${finalUrgency} — a matched clinical rule requires at least this level, regardless of the AI's own estimate.)`
        : recommendation.explanation;

    const saved = await prisma.$transaction(async (tx) => {
      // upsert, not create: re-analysis (manual "Re-analyze", or a retry
      // after an earlier import/AI attempt) targets an assessment that may
      // already have a Recommendation row — Recommendation.assessmentId is
      // unique, so a bare create() would fail on every second analysis.
      const rec = await tx.recommendation.upsert({
        where: { assessmentId },
        create: {
          assessmentId,
          likelyConditions: recommendation.likelyConditions,
          confidenceScore: recommendation.confidenceScore,
          recommendedDept: recommendation.recommendedDept,
          nextSteps: recommendation.nextSteps,
          riskFactors: recommendation.riskFactors,
          redFlagSymptoms: recommendation.redFlagSymptoms,
          homeCareAdvice: recommendation.homeCareAdvice,
          explanation,
          modelName,
        },
        update: {
          likelyConditions: recommendation.likelyConditions,
          confidenceScore: recommendation.confidenceScore,
          recommendedDept: recommendation.recommendedDept,
          nextSteps: recommendation.nextSteps,
          riskFactors: recommendation.riskFactors,
          redFlagSymptoms: recommendation.redFlagSymptoms,
          homeCareAdvice: recommendation.homeCareAdvice,
          explanation,
          modelName,
        },
      });

      await tx.assessment.update({
        where: { id: assessmentId },
        data: {
          urgencyLevel: finalUrgency,
          status: "AWAITING_REVIEW",
        },
      });

      return rec;
    });

    await auditService.log({
      action: "AI_RECOMMENDATION_GENERATED",
      assessmentId,
      metadata: { aiUrgencyLevel: recommendation.urgencyLevel, finalUrgency, modelName },
    });

    return saved;
  },
};
