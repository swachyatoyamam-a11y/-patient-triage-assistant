import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/async-handler";
import { ApiError } from "@/utils/api-error";
import { healthConnectionService } from "@/services/health-connection.service";
import { metricsQuerySchema } from "@/validators/health-data.validator";
import { env } from "@/config/env";

function userId(req: Request): string {
  if (!req.user) throw ApiError.unauthorized();
  return req.user.id;
}

export const healthDataController = {
  listProviders: asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json({ providers: healthConnectionService.listProviders() });
  }),

  listConnections: asyncHandler(async (req: Request, res: Response) => {
    const connections = await healthConnectionService.listConnections(userId(req));
    res.status(200).json({ connections });
  }),

  connect: asyncHandler(async (req: Request, res: Response) => {
    const result = await healthConnectionService.connect(userId(req), req.params.provider!);
    res.status(200).json(result);
  }),

  // Public route (the browser is redirected here by the OAuth provider
  // itself, with no Authorization header) — the patient is identified by
  // `state`, which getAuthUrl() sets to the patientId. See the route file
  // comment for why this can't sit behind requireAuth.
  oauthCallback: asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) throw ApiError.badRequest("Missing OAuth code/state");
    await healthConnectionService.handleOAuthCallback(state, req.params.provider!, code);
    const frontendUrl = env.FRONTEND_URL ?? env.CORS_ORIGIN;
    res.redirect(`${frontendUrl}/health-data?connected=${req.params.provider}`);
  }),

  sync: asyncHandler(async (req: Request, res: Response) => {
    const result = await healthConnectionService.sync(userId(req), req.params.provider!);
    res.status(200).json(result);
  }),

  disconnect: asyncHandler(async (req: Request, res: Response) => {
    await healthConnectionService.disconnect(userId(req), req.params.provider!);
    res.status(204).send();
  }),

  listMetrics: asyncHandler(async (req: Request, res: Response) => {
    const query = metricsQuerySchema.parse(req.query);
    const metrics = await healthConnectionService.listMetrics(userId(req), {
      metricType: query.type,
      from: query.from,
      to: query.to,
    });
    res.status(200).json({ metrics });
  }),
};
