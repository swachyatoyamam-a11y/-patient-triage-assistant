import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/async-handler";
import { prisma } from "@/lib/prisma";
import { auditService } from "@/services/audit.service";
import { analyticsService } from "@/services/analytics.service";

export const adminController = {
  listUsers: asyncHandler(async (req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        // passwordHash intentionally excluded
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.status(200).json({ users });
  }),

  deactivateUser: asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.status(200).json({ user: { id: user.id, isActive: user.isActive } });
  }),

  listAuditLogs: asyncHandler(async (req: Request, res: Response) => {
    const logs = await auditService.list({
      action: req.query.action as string | undefined,
      limit: Number(req.query.limit) || 50,
    });
    res.status(200).json({ logs });
  }),
};

export const analyticsController = {
  summary: asyncHandler(async (_req: Request, res: Response) => {
    const summary = await analyticsService.summary();
    res.status(200).json(summary);
  }),

  commonSymptoms: asyncHandler(async (_req: Request, res: Response) => {
    const symptoms = await analyticsService.commonSymptoms();
    res.status(200).json({ symptoms });
  }),

  extendedSummary: asyncHandler(async (_req: Request, res: Response) => {
    const summary = await analyticsService.extendedSummary();
    res.status(200).json(summary);
  }),

  patientDetail: asyncHandler(async (req: Request, res: Response) => {
    const detail = await analyticsService.patientDetail(req.params.patientId!);
    res.status(200).json(detail);
  }),
};
