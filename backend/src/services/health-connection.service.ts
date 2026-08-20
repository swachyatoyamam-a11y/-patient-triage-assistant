import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/api-error";
import { auditService } from "@/services/audit.service";
import { encryptToken } from "@/utils/crypto";
import { HEALTH_PROVIDERS, getProvider } from "@/health/registry";
import type { HealthIngestInput } from "@/validators/health-data.validator";
import type { HealthProvider as HealthProviderEnum, Prisma } from "@prisma/client";

async function requirePatientId(userId: string): Promise<string> {
  const patient = await prisma.patient.findUnique({ where: { userId } });
  if (!patient) throw ApiError.notFound("Patient profile not found");
  return patient.id;
}

export const healthConnectionService = {
  /** Provider catalog for the "Connected Health Data" UI — includes
   * providers that aren't configured yet (e.g. Fitbit with no API keys
   * set) so the interface stays visible rather than silently disappearing;
   * the UI just shows them disabled with the reason. */
  listProviders() {
    return HEALTH_PROVIDERS.map((p) => ({
      id: p.id,
      label: p.label,
      configured: p.isConfigured(),
      requiresOAuth: Boolean(p.requiresOAuth),
      requiresNativeApp: Boolean(p.requiresNativeApp),
      unavailableReason: p.isConfigured() ? null : p.unavailableReason?.() ?? "Not available.",
    }));
  },

  async listConnections(userId: string) {
    const patientId = await requirePatientId(userId);
    const connections = await prisma.healthConnection.findMany({
      where: { patientId },
      select: {
        id: true,
        provider: true,
        status: true,
        scopes: true,
        lastSyncedAt: true,
        connectedAt: true,
        disconnectedAt: true,
        // token fields intentionally excluded — never leave the service layer
      },
    });
    return connections;
  },

  /** For the Demo provider: connects immediately and seeds initial metrics.
   * For OAuth providers: returns { authUrl } for the frontend to redirect to
   * — no HealthConnection row is created until the callback completes. */
  async connect(userId: string, providerId: string) {
    const patientId = await requirePatientId(userId);
    const provider = getProvider(providerId);
    if (!provider.isConfigured()) {
      throw ApiError.badRequest(`${provider.label} is not yet configured on this server.`);
    }

    if (provider.requiresOAuth) {
      return { authUrl: provider.getAuthUrl!(patientId) };
    }

    const connection = await prisma.healthConnection.upsert({
      where: { patientId_provider: { patientId, provider: provider.id as HealthProviderEnum } },
      create: { patientId, provider: provider.id as HealthProviderEnum, status: "CONNECTED", scopes: [] },
      update: { status: "CONNECTED", disconnectedAt: null },
    });

    await this._syncMetrics(connection.id, patientId, provider);
    await auditService.log({ action: "HEALTH_CONNECTION_CREATED", userId, metadata: { provider: provider.id } });

    return { connection };
  },

  /** Completes an OAuth flow — exchanges the code, encrypts tokens, and
   * creates/updates the HealthConnection row. */
  async handleOAuthCallback(patientId: string, providerId: string, code: string) {
    const provider = getProvider(providerId);
    if (!provider.requiresOAuth || !provider.exchangeCode) {
      throw ApiError.badRequest(`${provider.label} does not use OAuth.`);
    }
    const tokens = await provider.exchangeCode(code);

    const connection = await prisma.healthConnection.upsert({
      where: { patientId_provider: { patientId, provider: provider.id as HealthProviderEnum } },
      create: {
        patientId,
        provider: provider.id as HealthProviderEnum,
        status: "CONNECTED",
        scopes: tokens.scopes,
        accessTokenEnc: encryptToken(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
        tokenExpiresAt: tokens.expiresAt,
        externalAccountId: tokens.externalAccountId,
      },
      update: {
        status: "CONNECTED",
        scopes: tokens.scopes,
        accessTokenEnc: encryptToken(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
        tokenExpiresAt: tokens.expiresAt,
        externalAccountId: tokens.externalAccountId,
        disconnectedAt: null,
      },
    });

    await this._syncMetrics(connection.id, patientId, provider);
    await auditService.log({
      action: "HEALTH_CONNECTION_CREATED",
      metadata: { provider: provider.id, patientId },
    });

    return connection;
  },

  async sync(userId: string, providerId: string) {
    const patientId = await requirePatientId(userId);
    const provider = getProvider(providerId);
    const connection = await prisma.healthConnection.findUnique({
      where: { patientId_provider: { patientId, provider: provider.id as HealthProviderEnum } },
    });
    if (!connection || connection.status !== "CONNECTED") {
      throw ApiError.badRequest(`No active ${provider.label} connection to sync.`);
    }

    const count = await this._syncMetrics(connection.id, patientId, provider);
    await auditService.log({ action: "HEALTH_DATA_SYNCED", userId, metadata: { provider: provider.id, metricCount: count } });
    return { synced: count };
  },

  async _syncMetrics(connectionId: string, patientId: string, provider: ReturnType<typeof getProvider>) {
    const connection = await prisma.healthConnection.findUniqueOrThrow({ where: { id: connectionId } });
    const metrics = await provider.fetchMetrics(connection);

    if (metrics.length > 0) {
      await prisma.healthMetric.createMany({
        data: metrics.map((m) => ({
          patientId,
          connectionId,
          source: provider.id as HealthProviderEnum,
          metricType: m.metricType,
          value: m.value,
          unit: m.unit,
          recordedAt: m.recordedAt,
          metadata: m.metadata as Prisma.InputJsonValue | undefined,
        })),
      });
    }

    await prisma.healthConnection.update({ where: { id: connectionId }, data: { lastSyncedAt: new Date() } });
    return metrics.length;
  },

  /** Disconnects and wipes any stored tokens. Historical HealthMetric rows
   * are preserved (not deleted) for the clinical timeline, but the
   * AI-context service only ever reads from CONNECTED connections, so
   * disconnecting stops new data reaching the assistant immediately. */
  async disconnect(userId: string, providerId: string) {
    const patientId = await requirePatientId(userId);
    const provider = getProvider(providerId);
    const connection = await prisma.healthConnection.findUnique({
      where: { patientId_provider: { patientId, provider: provider.id as HealthProviderEnum } },
    });
    if (!connection) throw ApiError.notFound(`No ${provider.label} connection found.`);

    await prisma.healthConnection.update({
      where: { id: connection.id },
      data: {
        status: "DISCONNECTED",
        disconnectedAt: new Date(),
        accessTokenEnc: null,
        refreshTokenEnc: null,
        tokenExpiresAt: null,
      },
    });

    await auditService.log({ action: "HEALTH_CONNECTION_DISCONNECTED", userId, metadata: { provider: provider.id } });
  },

  async listMetrics(userId: string, filters: { metricType?: string; from?: Date; to?: Date }) {
    const patientId = await requirePatientId(userId);
    return prisma.healthMetric.findMany({
      where: {
        patientId,
        ...(filters.metricType && { metricType: filters.metricType }),
        ...(filters.from || filters.to
          ? { recordedAt: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) } }
          : {}),
      },
      orderBy: { recordedAt: "desc" },
      take: 500,
    });
  },

  /**
   * Shared ingest path for any `requiresNativeApp` provider (Apple Health,
   * Google Health Connect, or a future one) — the exact same code handles
   * all of them via the `provider` route param, rather than one pipeline
   * per platform. Readings arrive already validated (see
   * validators/health-data.validator.ts) — this layer's job is ownership,
   * persistence, and idempotency, not re-checking medical plausibility.
   *
   * Creates the HealthConnection lazily on first successful ingest (there
   * is no separate "register device" step for MVP purposes) and reuses the
   * exact same HealthMetric table every other provider writes to — nothing
   * downstream (timeline, AI context, clinical/admin views) needs to know
   * this reading came from a native app rather than a sync.
   */
  async ingest(userId: string, providerId: string, readings: HealthIngestInput["readings"]) {
    const patientId = await requirePatientId(userId);
    const provider = getProvider(providerId);
    if (!provider.requiresNativeApp) {
      throw ApiError.badRequest(
        `${provider.label} does not accept ingested readings — it syncs via ${provider.requiresOAuth ? "OAuth" : "the standard connect/sync flow"} instead.`
      );
    }

    const { connection, ingestedCount } = await prisma.$transaction(async (tx) => {
      const conn = await tx.healthConnection.upsert({
        where: { patientId_provider: { patientId, provider: provider.id as HealthProviderEnum } },
        create: { patientId, provider: provider.id as HealthProviderEnum, status: "CONNECTED", scopes: [] },
        update: { status: "CONNECTED", disconnectedAt: null },
      });

      // skipDuplicates relies on the (patientId, source, externalRecordId)
      // unique index — readings that supply externalId are idempotent
      // against resubmission; readings without one always insert fresh,
      // since Postgres never treats two NULLs as a conflict.
      const created = await tx.healthMetric.createMany({
        data: readings.map((r) => ({
          patientId,
          connectionId: conn.id,
          source: provider.id as HealthProviderEnum,
          metricType: r.metricType,
          value: r.value,
          unit: r.unit,
          recordedAt: r.recordedAt,
          externalRecordId: r.externalId ?? null,
        })),
        skipDuplicates: true,
      });

      await tx.healthConnection.update({ where: { id: conn.id }, data: { lastSyncedAt: new Date() } });

      return { connection: conn, ingestedCount: created.count };
    });

    await auditService.log({
      action: "HEALTH_DATA_INGESTED",
      userId,
      metadata: { provider: provider.id, submitted: readings.length, ingested: ingestedCount },
    });

    return {
      connectionId: connection.id,
      submitted: readings.length,
      ingested: ingestedCount,
      skipped: readings.length - ingestedCount,
    };
  },
};
