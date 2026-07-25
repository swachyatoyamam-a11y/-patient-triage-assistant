import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/async-handler";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";

export const patientController = {
  getProfile: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const patient = await prisma.patient.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
    });
    if (!patient) throw ApiError.notFound("Patient profile not found");
    res.status(200).json({ patient });
  }),

  getHistory: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const patient = await prisma.patient.findUnique({ where: { userId: req.user.id } });
    if (!patient) throw ApiError.notFound("Patient profile not found");

    const [medicalHistory, assessments] = await Promise.all([
      prisma.medicalHistoryEntry.findMany({ where: { patientId: patient.id } }),
      prisma.assessment.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: "desc" },
        include: { recommendation: true },
      }),
    ]);

    res.status(200).json({ medicalHistory, assessments });
  }),
};
