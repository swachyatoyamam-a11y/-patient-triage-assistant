import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/async-handler";
import { ApiError } from "@/utils/api-error";
import { patientProfileService } from "@/services/patient-profile.service";

function userId(req: Request): string {
  if (!req.user) throw ApiError.unauthorized();
  return req.user.id;
}

export const patientProfileController = {
  getFullProfile: asyncHandler(async (req: Request, res: Response) => {
    const profile = await patientProfileService.getFullProfile(userId(req));
    res.status(200).json(profile);
  }),

  addCondition: asyncHandler(async (req: Request, res: Response) => {
    const condition = await patientProfileService.addCondition(userId(req), req.body);
    res.status(201).json({ condition });
  }),
  updateCondition: asyncHandler(async (req: Request, res: Response) => {
    const condition = await patientProfileService.updateCondition(userId(req), req.params.id!, req.body);
    res.status(200).json({ condition });
  }),
  removeCondition: asyncHandler(async (req: Request, res: Response) => {
    await patientProfileService.removeCondition(userId(req), req.params.id!);
    res.status(204).send();
  }),

  addAllergy: asyncHandler(async (req: Request, res: Response) => {
    const allergy = await patientProfileService.addAllergy(userId(req), req.body);
    res.status(201).json({ allergy });
  }),
  updateAllergy: asyncHandler(async (req: Request, res: Response) => {
    const allergy = await patientProfileService.updateAllergy(userId(req), req.params.id!, req.body);
    res.status(200).json({ allergy });
  }),
  removeAllergy: asyncHandler(async (req: Request, res: Response) => {
    await patientProfileService.removeAllergy(userId(req), req.params.id!);
    res.status(204).send();
  }),

  addMedication: asyncHandler(async (req: Request, res: Response) => {
    const medication = await patientProfileService.addMedication(userId(req), req.body);
    res.status(201).json({ medication });
  }),
  updateMedication: asyncHandler(async (req: Request, res: Response) => {
    const medication = await patientProfileService.updateMedication(userId(req), req.params.id!, req.body);
    res.status(200).json({ medication });
  }),
  removeMedication: asyncHandler(async (req: Request, res: Response) => {
    await patientProfileService.removeMedication(userId(req), req.params.id!);
    res.status(204).send();
  }),

  addSurgery: asyncHandler(async (req: Request, res: Response) => {
    const surgery = await patientProfileService.addSurgery(userId(req), req.body);
    res.status(201).json({ surgery });
  }),
  updateSurgery: asyncHandler(async (req: Request, res: Response) => {
    const surgery = await patientProfileService.updateSurgery(userId(req), req.params.id!, req.body);
    res.status(200).json({ surgery });
  }),
  removeSurgery: asyncHandler(async (req: Request, res: Response) => {
    await patientProfileService.removeSurgery(userId(req), req.params.id!);
    res.status(204).send();
  }),

  updateEmergencyInfo: asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientProfileService.updateEmergencyInfo(userId(req), req.body);
    res.status(200).json({ patient });
  }),
};
