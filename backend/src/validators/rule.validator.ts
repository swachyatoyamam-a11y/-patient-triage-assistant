import { z } from "zod";
import { ruleConditionSchema } from "@/ai/rules/condition-evaluator";

export const ruleSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  condition: ruleConditionSchema.refine(
    (c) => Object.keys(c).some((k) => c[k as keyof typeof c] !== undefined),
    { message: "condition must specify at least one of allOf/anyOf/noneOf/ageUnder/ageOver" }
  ),
  resultingUrgency: z.enum(["EMERGENCY", "URGENT", "MODERATE", "ROUTINE"]),
  isActive: z.boolean().default(true),
});

export type RuleInput = z.infer<typeof ruleSchema>;
