import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/async-handler";
import { assessmentService } from "@/services/assessment.service";
import { recommendationService } from "@/services/recommendation.service";
import { ruleEngineService } from "@/services/rule-engine.service";
import { ApiError } from "@/utils/api-error";
import { logger } from "@/config/logger";
import { prisma } from "@/lib/prisma";
import { auditService } from "@/services/audit.service";
import { listAssessmentsQuerySchema } from "@/validators/assessment.validator";

export const assessmentController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const patient = await prisma.patient.findUnique({ where: { userId: req.user.id } });
    if (!patient) throw ApiError.forbidden("Only patient accounts can start an assessment");

    const assessment = await assessmentService.create(patient.id, req.body);

    // Intake is already saved at this point — everything below is best
    // effort. A failure here must never make the patient's submitted
    // intake look like it didn't go through.
    //
    // Rule engine runs FIRST and unconditionally: it's deterministic, has
    // no external dependency, and a confirmed EMERGENCY match must never
    // wait on an LLM round trip. Only when it does NOT already confirm an
    // emergency does the AI layer run — and even then, the rule engine's
    // result becomes a floor the AI can escalate but never downgrade.
    let analysisFailed = false;
    try {
      const ruleResult = await ruleEngineService.evaluateAndApply(assessment.id);
      if (!ruleResult.shortCircuited) {
        await recommendationService.generateFor(assessment.id, ruleResult.highestUrgency);
      }
    } catch (err) {
      analysisFailed = true;
      logger.error("Auto-analysis failed after assessment creation", {
        assessmentId: assessment.id,
        error: err instanceof Error ? err.message : err,
      });
      await auditService.log({
        action: "AI_ANALYSIS_FAILED",
        assessmentId: assessment.id,
        metadata: { error: err instanceof Error ? err.message : String(err) },
      });
    }

    const finalAssessment = await assessmentService.getById(assessment.id);

    res.status(201).json({
      assessment: finalAssessment,
      analysisFailed,
      notice: "This is not a medical diagnosis. Please consult a qualified healthcare professional.",
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const assessment = await assessmentService.getById(req.params.id!);

    // Clinical staff can view any assessment; a patient may only view their
    // own — GET /:id has no role guard at the route level (staff need it
    // for the queue), so ownership must be enforced here instead.
    if (req.user.role === "PATIENT") {
      const patient = await prisma.patient.findUnique({ where: { userId: req.user.id } });
      if (!patient || assessment.patientId !== patient.id) throw ApiError.forbidden();
    }

    res.status(200).json({ assessment });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = listAssessmentsQuerySchema.parse(req.query);
    const assessments = await assessmentService.list(query);
    res.status(200).json({ assessments });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const assessment = await assessmentService.update(req.params.id!, req.user.id, req.body);
    res.status(200).json({ assessment });
  }),

  reanalyze: asyncHandler(async (req: Request, res: Response) => {
    // Manual re-trigger also runs the rule engine first, for the same
    // reason: staff shouldn't be able to accidentally bypass a red flag
    // by retrying only the AI half.
    const ruleResult = await ruleEngineService.evaluateAndApply(req.params.id!);
    if (!ruleResult.shortCircuited) {
      await recommendationService.generateFor(req.params.id!, ruleResult.highestUrgency);
    }
    const assessment = await assessmentService.getById(req.params.id!);
    res.status(200).json({ assessment });
  }),
};
