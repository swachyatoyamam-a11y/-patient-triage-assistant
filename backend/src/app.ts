import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { apiRouter } from "@/routes";
import { apiLimiter } from "@/middleware/rate-limit";
import { errorHandler } from "@/middleware/error-handler";
import { notFoundHandler } from "@/middleware/not-found";

export function createApp() {
  const app = express();

  // Trust the first proxy hop (Railway/Render/etc sit in front of us) so
  // rate limiting and req.ip see the real client address, not the proxy's.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  app.use("/api", apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
