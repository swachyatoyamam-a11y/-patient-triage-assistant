import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/async-handler";
import { ruleService } from "@/services/rule.service";
import { ApiError } from "@/utils/api-error";
import { KNOWN_TAGS } from "@/ai/rules/symptom-tags";

export const ruleController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const rules = await ruleService.list();
    res.status(200).json({ rules });
  }),

  /** Lets the admin rule-builder UI (Phase 7) offer a dropdown instead of
   * free text — a typo'd tag here is a rule that silently never fires. */
  knownTags: asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json({ tags: KNOWN_TAGS });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const rule = await ruleService.create(req.body, req.user.id);
    res.status(201).json({ rule });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const rule = await ruleService.update(req.params.id!, req.body, req.user.id);
    res.status(200).json({ rule });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await ruleService.delete(req.params.id!, req.user.id);
    res.status(204).send();
  }),
};
