import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/async-handler";
import { appointmentService } from "@/services/appointment.service";
import { ApiError } from "@/utils/api-error";
import { prisma } from "@/lib/prisma";

export const appointmentController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const patient = await prisma.patient.findUnique({ where: { userId: req.user.id } });
    if (!patient) throw ApiError.forbidden("Only patient accounts can book appointments");

    const appointment = await appointmentService.create(patient.id, req.body);
    res.status(201).json({ appointment });
  }),

  listMine: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const patient = await prisma.patient.findUnique({ where: { userId: req.user.id } });
    if (!patient) throw ApiError.forbidden();

    const appointments = await appointmentService.listForPatient(patient.id);
    res.status(200).json({ appointments });
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await appointmentService.updateStatus(req.params.id!, req.body.status);
    res.status(200).json({ appointment });
  }),
};
