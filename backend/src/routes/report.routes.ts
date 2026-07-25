import { Router } from "express";
import { reportController } from "@/controllers/report.controller";
import { requireAuth } from "@/middleware/auth.middleware";

export const reportRoutes = Router();

reportRoutes.get("/:id", requireAuth, reportController.download);
