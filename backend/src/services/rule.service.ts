import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { auditService } from "@/services/audit.service";
import { KNOWN_TAGS } from "@/ai/rules/symptom-tags";
import type { RuleCondition } from "@/ai/rules/condition-evaluator";
import type { RuleInput } from "@/validators/rule.validator";

/**
 * Catches the single most likely authoring mistake in the admin UI: a
 * typo'd or invented tag that will simply never match anything, silently.
 * A rule that never fires is worse than no rule at all — it gives false
 * confidence that a red flag is covered.
 */
function assertKnownTags(condition: RuleCondition) {
  const referenced = [...(condition.allOf ?? []), ...(condition.anyOf ?? []), ...(condition.noneOf ?? [])];
  const unknown = referenced.filter((tag) => !KNOWN_TAGS.includes(tag));
  if (unknown.length > 0) {
    throw ApiError.badRequest(
      `Unrecognized symptom tag(s): ${unknown.join(", ")}. Known tags: ${KNOWN_TAGS.join(", ")}`
    );
  }
}

/**
 * CRUD over the `Rule` table only — actually *evaluating* rules against an
 * assessment is the rule engine's job (src/ai/rules). Keeping rule storage
 * and rule evaluation separate means clinical staff can edit rules from
 * the admin UI without touching engine code.
 */
export const ruleService = {
  async list() {
    return prisma.rule.findMany({ orderBy: { createdAt: "desc" } });
  },

  async create(input: RuleInput, createdById: string) {
    assertKnownTags(input.condition);
    const rule = await prisma.rule.create({ data: { ...input, createdById } });
    await auditService.log({ action: "RULE_CREATED", userId: createdById, metadata: { ruleId: rule.id } });
    return rule;
  },

  async update(id: string, input: Partial<RuleInput>, updatedById: string) {
    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Rule not found");
    if (input.condition) assertKnownTags(input.condition);

    const rule = await prisma.rule.update({ where: { id }, data: input });
    await auditService.log({ action: "RULE_UPDATED", userId: updatedById, metadata: { ruleId: id } });
    return rule;
  },

  async delete(id: string, deletedById: string) {
    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Rule not found");

    await prisma.rule.delete({ where: { id } });
    await auditService.log({ action: "RULE_DELETED", userId: deletedById, metadata: { ruleId: id } });
  },
};
