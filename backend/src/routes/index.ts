import { Router } from "express";
import { authRoutes } from "@/routes/auth.routes";
import { patientRoutes } from "@/routes/patient.routes";
import { assessmentRoutes } from "@/routes/assessment.routes";
import { appointmentRoutes } from "@/routes/appointment.routes";
import { reportRoutes } from "@/routes/report.routes";
import { adminRoutes } from "@/routes/admin.routes";
import { analyticsRoutes } from "@/routes/analytics.routes";
import { healthRoutes } from "@/routes/health.routes";

export const apiRouter = Router();

apiRouter.use("/health", healthRoutes);
apiRouter.use("/auth", authRoutes);
apiRouter.use("/patients", patientRoutes);
apiRouter.use("/assessments", assessmentRoutes);
apiRouter.use("/appointments", appointmentRoutes);
apiRouter.use("/reports", reportRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/analytics", analyticsRoutes);
