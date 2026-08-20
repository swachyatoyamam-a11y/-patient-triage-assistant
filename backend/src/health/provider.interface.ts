import type { HealthConnection } from "@prisma/client";

export type NormalizedMetric = {
  metricType: string;
  value: number;
  unit: string;
  recordedAt: Date;
  metadata?: Record<string, unknown>;
};

export type TokenBundle = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  externalAccountId?: string;
  scopes: string[];
};

/**
 * A pluggable integration point so providers can be added safely later
 * without touching the connect/sync/disconnect routes or the AI-context
 * pipeline — see docs/deployment/environment-variables.md for what each
 * provider needs configured before `isConfigured()` returns true.
 */
export interface HealthDataProvider {
  readonly id: "DEMO" | "FITBIT" | "APPLE_HEALTH" | "GOOGLE_HEALTH_CONNECT";
  readonly label: string;

  /** Whether this provider has everything it needs (API keys, etc.) to
   * actually be connectable right now — the UI never shows a working
   * "Connect" button for a provider this returns false for. For a
   * `requiresNativeApp` provider this stays false until a real companion
   * app exists to actually produce data — there is deliberately no way to
   * fake a connection into existence from the web app alone. */
  isConfigured(): boolean;

  /** Plain-English reason a provider isn't connectable, shown in the UI
   * instead of a fake connect flow. Only meaningful when isConfigured() is
   * false. */
  unavailableReason?(): string;

  /** True for providers that need an OAuth redirect (Fitbit). False/absent
   * for providers that connect immediately with no external round trip
   * (Demo) — the connection service branches on this, not on provider id,
   * so a future non-OAuth provider needs no route changes. */
  requiresOAuth?: boolean;

  /**
   * True for providers whose data can only ever be read by a native
   * iOS/Android companion app (HealthKit, Health Connect) — there is no
   * cloud API for the backend to call on its own behalf (see
   * apple-health-provider.ts / google-health-connect-provider.ts for why).
   * These providers never implement getAuthUrl/exchangeCode; instead, a
   * connection is created lazily the first time the companion app calls
   * the shared ingest endpoint (POST /health-data/connections/:provider/ingest)
   * with a validated batch of readings — see health-connection.service.ts
   * `ingest()`. The connect/:provider route still refuses to fabricate a
   * connection for these providers (same isConfigured() gate as any other
   * provider), so nothing here creates a false impression of being
   * connected before real data has ever arrived.
   */
  requiresNativeApp?: boolean;

  /** OAuth providers return the URL to redirect the patient to. */
  getAuthUrl?(patientId: string): string;

  /** Exchanges an OAuth authorization code for tokens. OAuth providers only. */
  exchangeCode?(code: string): Promise<TokenBundle>;

  /** Fetches the latest metrics for an existing connection. Implementations
   * are responsible for decrypting their own tokens via utils/crypto.ts.
   * Not applicable to `requiresNativeApp` providers — data arrives via the
   * ingest endpoint instead, so these implementations simply throw. */
  fetchMetrics(connection: HealthConnection): Promise<NormalizedMetric[]>;
}
