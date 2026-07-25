import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type AuditInput = {
  action: string;
  userId?: string;
  assessmentId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
};

/**
 * Every clinically-relevant action (assessment created/reviewed, rule
 * changed, user role changed) should call this. Centralized so the shape
 * never drifts and admins get one place to query from.
 */
export const auditService = {
  async log(input: AuditInput) {
    return prisma.auditLog.create({
      data: {
        action: input.action,
        userId: input.userId,
        assessmentId: input.assessmentId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress,
      },
    });
  },

  async list(filters: { action?: string; limit: number }) {
    return prisma.auditLog.findMany({
      where: filters.action ? { action: filters.action } : undefined,
      take: filters.limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true, role: true } } },
    });
  },
};
