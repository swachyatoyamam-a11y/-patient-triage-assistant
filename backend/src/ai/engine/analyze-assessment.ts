import type { Assessment, Symptom } from "@prisma/client";
import { logger } from "@/config/logger";
import { ApiError } from "@/utils/api-error";
import { buildSystemPrompt, buildUserPrompt } from "@/ai/prompts/triage-analysis.prompt";
import { aiRecommendationSchema, type AiRecommendation } from "@/ai/engine/schema";
import type { AiProvider } from "@/ai/engine/provider.interface";
import { GeminiProvider } from "@/ai/engine/providers/gemini-provider";
import { AnthropicProvider } from "@/ai/engine/providers/anthropic-provider";
import { OpenAiProvider } from "@/ai/engine/providers/openai-provider";
import { env } from "@/config/env";
import type { PatientProfileContext } from "@/services/patient-context.service";
import type { HealthMetricContext } from "@/services/health-context.service";

type AssessmentWithSymptoms = Assessment & { symptoms: Symptom[] };

/**
 * Picks a provider based on what's configured, preferring Gemini. This
 * is the "hybrid AI" seam: swapping providers, or later routing certain
 * cases to one vendor vs another, only touches this function.
 */
function selectProvider(): AiProvider {
  if (env.GEMINI_API_KEY) return new GeminiProvider();
  if (env.ANTHROPIC_API_KEY) return new AnthropicProvider();
  if (env.OPENAI_API_KEY) return new OpenAiProvider();
  throw new Error(
    "No AI provider configured — set GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY in backend/.env"
  );
}

/** Strips code fences a model sometimes adds despite instructions not to. */
function extractJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

async function requestOnce(
  provider: AiProvider,
  assessment: AssessmentWithSymptoms,
  profileContext?: PatientProfileContext,
  healthContext?: HealthMetricContext[]
): Promise<AiRecommendation> {
  const system = buildSystemPrompt();
  const user = buildUserPrompt(assessment, profileContext, healthContext);
  const raw = await provider.complete(system, user);
  const parsed = extractJson(raw);
  return aiRecommendationSchema.parse(parsed);
}

/**
 * Runs AI analysis for an assessment and returns validated, schema-safe
 * output. Retries exactly once on a malformed/invalid response before
 * giving up — a single retry catches most transient formatting slips
 * without masking a genuinely broken prompt or provider outage.
 *
 * Callers are responsible for persisting the result (see
 * recommendation.service.ts) and for running the deterministic rule
 * engine (Phase 6) — that engine's EMERGENCY-level red flags should run
 * BEFORE this and can short-circuit it entirely for clear-cut cases.
 */
export async function analyzeAssessment(
  assessment: AssessmentWithSymptoms,
  profileContext?: PatientProfileContext,
  healthContext?: HealthMetricContext[]
): Promise<{ recommendation: AiRecommendation; modelName: string }> {
  const provider = selectProvider();

  try {
    const recommendation = await requestOnce(provider, assessment, profileContext, healthContext);
    return { recommendation, modelName: provider.modelName };
  } catch (firstError) {
    logger.warn("AI analysis first attempt failed, retrying once", {
      assessmentId: assessment.id,
      error: firstError instanceof Error ? firstError.message : firstError,
    });

    try {
      const recommendation = await requestOnce(provider, assessment, profileContext, healthContext);
      return { recommendation, modelName: provider.modelName };
    } catch (secondError) {
      logger.error("AI analysis failed after retry", {
        assessmentId: assessment.id,
        error: secondError instanceof Error ? secondError.message : secondError,
      });
      throw new ApiError(
        422,
        "AI analysis could not produce a valid recommendation. This assessment needs manual clinician review."
      );
    }
  }
}
