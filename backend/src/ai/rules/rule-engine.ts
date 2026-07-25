import type { Assessment, Rule, Symptom } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateCondition, type RuleCondition } from "@/ai/rules/condition-evaluator";
import { normalizeSymptomTags, extractAge } from "@/ai/rules/symptom-tags";
import { moreSevereUrgency } from "@/utils/urgency";

type AssessmentWithSymptoms = Assessment & { symptoms: Symptom[] };

export type RuleEngineResult = {
  matchedRules: Rule[];
  /** null if no active rule matched — the AI layer runs unconstrained. */
  highestUrgency: Rule["resultingUrgency"] | null;
};

/**
 * Evaluates every active Rule against an assessment's symptoms. Runs all
 * of them rather than stopping at the first match, so every matching rule
 * gets recorded (useful for the clinician reviewing the case, and for
 * audit) even though only the single most severe result is applied.
 */
export async function evaluateRules(assessment: AssessmentWithSymptoms): Promise<RuleEngineResult> {
  const rules = await prisma.rule.findMany({ where: { isActive: true } });
  const tags = normalizeSymptomTags(assessment);
  const age = extractAge(assessment);

  const matchedRules = rules.filter((rule) =>
    evaluateCondition(rule.condition as RuleCondition, { tags, age })
  );

  const highestUrgency = matchedRules.reduce<Rule["resultingUrgency"] | null>(
    (highest, rule) => moreSevereUrgency(highest, rule.resultingUrgency),
    null
  );

  return { matchedRules, highestUrgency };
}
