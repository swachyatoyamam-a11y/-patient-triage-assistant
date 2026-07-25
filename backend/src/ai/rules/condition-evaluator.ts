import { z } from "zod";

/**
 * The DSL every Rule.condition must satisfy. Kept intentionally small and
 * flat — a deterministic engine is only trustworthy if a clinician can read
 * a condition and immediately know what it checks. No nested boolean logic,
 * no regex, no arbitrary code.
 */
export const ruleConditionSchema = z.object({
  /** All of these symptom tags must be present. */
  allOf: z.array(z.string()).optional(),
  /** At least one of these symptom tags must be present. */
  anyOf: z.array(z.string()).optional(),
  /** None of these symptom tags may be present. */
  noneOf: z.array(z.string()).optional(),
  /** Patient age must be strictly under this value. */
  ageUnder: z.number().optional(),
  /** Patient age must be strictly over this value. */
  ageOver: z.number().optional(),
});

export type RuleCondition = z.infer<typeof ruleConditionSchema>;

export type EvaluationContext = {
  tags: Set<string>;
  age: number;
};

/**
 * Pure function, no I/O — every branch is a simple AND across whichever
 * clauses the rule actually specifies. A rule with none of these keys set
 * would trivially match everything, which is almost certainly a mistake,
 * so callers should treat an empty condition as invalid at write time
 * (see rule.validator.ts) rather than rely on this function to catch it.
 */
export function evaluateCondition(condition: RuleCondition, ctx: EvaluationContext): boolean {
  if (condition.allOf && !condition.allOf.every((tag) => ctx.tags.has(tag))) return false;
  if (condition.anyOf && !condition.anyOf.some((tag) => ctx.tags.has(tag))) return false;
  if (condition.noneOf && condition.noneOf.some((tag) => ctx.tags.has(tag))) return false;
  if (condition.ageUnder !== undefined && !(ctx.age < condition.ageUnder)) return false;
  if (condition.ageOver !== undefined && !(ctx.age > condition.ageOver)) return false;
  return true;
}
