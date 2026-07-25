import { Router } from "express";
import { authController } from "@/controllers/auth.controller";
import { validateBody } from "@/middleware/validate";
import { registerSchema, loginSchema } from "@/validators/auth.validator";
import { requireAuth } from "@/middleware/auth.middleware";
import { authLimiter } from "@/middleware/rate-limit";

export const authRoutes = Router();

authRoutes.post("/register", authLimiter, validateBody(registerSchema), authController.register);
authRoutes.post("/login", authLimiter, validateBody(loginSchema), authController.login);
authRoutes.get("/me", requireAuth, authController.me);
