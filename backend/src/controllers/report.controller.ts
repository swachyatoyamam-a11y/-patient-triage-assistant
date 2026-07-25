import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/async-handler";
import { reportService } from "@/services/report.service";
import { auditService } from "@/services/audit.service";

export const reportController = {
  download: asyncHandler(async (req: Request, res: Response) => {
    await auditService.log({
      action: "REPORT_DOWNLOADED",
      assessmentId: req.params.id,
      userId: req.user?.id,
    });
    await reportService.streamAssessmentReport(req.params.id!, res);
  }),
};
