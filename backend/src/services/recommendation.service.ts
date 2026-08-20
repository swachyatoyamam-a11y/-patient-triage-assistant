import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { analyzeAssessment } from "@/ai/engine/analyze-assessment";
import { auditService } from "@/services/audit.service";
import { moreSevereUrgency, URGENCY_SEVERITY } from "@/utils/urgency";
import { patientContextService } from "@/services/patient-context.service";
import { healthContextService } from "@/services/health-context.service";
import type { UrgencyLevel, Prisma } from "@prisma/client";

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

    // Automatic context: the patient's persistent medical profile always
    // applies; recent health-device data only applies if the patient
    // currently has an authorized (CONNECTED) provider — see
    // health-context.service.ts for exactly how that's enforced. Neither
    // failure here should block the assessment itself, so a lookup error
    // degrades to "no context" rather than failing the whole analysis.
    const [profileContext, healthContext] = await Promise.all([
      patientContextService.getProfileContext(assessment.patientId).catch(() => undefined),
      healthContextService.getRecentHealthContext(assessment.patientId).catch(() => []),
    ]);

    const { recommendation, modelName } = await analyzeAssessment(assessment, profileContext, healthContext);
    const finalUrgency =
      moreSevereUrgency(floorUrgency, recommendation.urgencyLevel) ?? recommendation.urgencyLevel;

    // True when the AI's own read of the case was more severe than the
    // deterministic rule floor — i.e. the AI caught something on its own
    // that the rules alone wouldn't have flagged. (Not the same as
    // `finalUrgency !== recommendation.urgencyLevel`, which instead marks
    // the opposite case: a rule floor pulling the result up past a milder
    // AI estimate.)
    const wasEscalatedByAi =
      Boolean(floorUrgency) && URGENCY_SEVERITY[recommendation.urgencyLevel] < URGENCY_SEVERITY[floorUrgency!];

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
          wasEscalatedByAi,
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
          wasEscalatedByAi,
        },
      });

      await tx.assessment.update({
        where: { id: assessmentId },
        data: {
          urgencyLevel: finalUrgency,
          status: "AWAITING_REVIEW",
        },
      });

      // Frozen copy of exactly what context the AI saw — audit/explainability,
      // and what the patient-facing "included from your profile" disclosure
      // reads from. upsert for the same re-analysis reason as Recommendation
      // above (AssessmentHealthSnapshot.assessmentId is also unique).
      const snapshot = { profile: profileContext ?? null, healthMetrics: healthContext ?? [] } as Prisma.InputJsonValue;
      await tx.assessmentHealthSnapshot.upsert({
        where: { assessmentId },
        create: { assessmentId, snapshot },
        update: { snapshot },
      });

      return rec;
    });

    await auditService.log({
      action: "AI_RECOMMENDATION_GENERATED",
      assessmentId,
      metadata: { aiUrgencyLevel: recommendation.urgencyLevel, finalUrgency, modelName, wasEscalatedByAi },
    });

    return saved;
  },
};
