import { Router } from "express";
import { adminController } from "@/controllers/admin.controller";
import { ruleController } from "@/controllers/rule.controller";
import { requireAuth, requireRole } from "@/middleware/auth.middleware";
import { validateBody } from "@/middleware/validate";
import { ruleSchema } from "@/validators/rule.validator";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole("ADMIN"));

adminRoutes.get("/users", adminController.listUsers);
adminRoutes.patch("/users/:id/deactivate", adminController.deactivateUser);
adminRoutes.get("/audit-logs", adminController.listAuditLogs);

adminRoutes.get("/rules", ruleController.list);
adminRoutes.get("/rules/tags", ruleController.knownTags);
adminRoutes.post("/rules", validateBody(ruleSchema), ruleController.create);
adminRoutes.patch("/rules/:id", ruleController.update);
adminRoutes.delete("/rules/:id", ruleController.remove);
