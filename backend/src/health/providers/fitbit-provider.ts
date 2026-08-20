import type { HealthConnection } from "@prisma/client";
import type { HealthDataProvider, NormalizedMetric, TokenBundle } from "@/health/provider.interface";
import { env } from "@/config/env";
import { decryptToken } from "@/utils/crypto";
import { logger } from "@/config/logger";

/**
 * Real Fitbit Web API integration (OAuth2 Authorization Code flow) — this
 * is genuinely functional, not a stub, but only activates once the user
 * registers a free app at dev.fitbit.com and supplies FITBIT_CLIENT_ID /
 * FITBIT_CLIENT_SECRET / FITBIT_REDIRECT_URI. Until then isConfigured()
 * returns false and the UI shows this provider as present-but-not-yet-set-up
 * rather than hiding it or faking a connection.
 */
const AUTHORIZE_URL = "https://www.fitbit.com/oauth2/authorize";
const TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const SCOPES = ["heartrate", "activity", "sleep", "weight", "oxygen_saturation"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fitbitFetch(path: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`https://api.fitbit.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Fitbit API request failed (${res.status}): ${path}`);
  }
  return res.json();
}

export const fitbitProvider: HealthDataProvider = {
  id: "FITBIT",
  label: "Fitbit",
  requiresOAuth: true,

  isConfigured() {
    return Boolean(env.FITBIT_CLIENT_ID && env.FITBIT_CLIENT_SECRET && env.FITBIT_REDIRECT_URI);
  },

  unavailableReason() {
    return "Requires a Fitbit developer app — register free at dev.fitbit.com and configure FITBIT_CLIENT_ID/FITBIT_CLIENT_SECRET server-side.";
  },

  getAuthUrl(patientId: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.FITBIT_CLIENT_ID!,
      redirect_uri: env.FITBIT_REDIRECT_URI!,
      scope: SCOPES.join(" "),
      state: patientId,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<TokenBundle> {
    const basicAuth = Buffer.from(`${env.FITBIT_CLIENT_ID}:${env.FITBIT_CLIENT_SECRET}`).toString("base64");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.FITBIT_CLIENT_ID!,
        grant_type: "authorization_code",
        redirect_uri: env.FITBIT_REDIRECT_URI!,
        code,
      }),
    });
    if (!res.ok) {
      throw new Error(`Fitbit token exchange failed (${res.status})`);
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user_id: string;
      scope: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      externalAccountId: data.user_id,
      scopes: data.scope.split(" "),
    };
  },

  async fetchMetrics(connection: HealthConnection): Promise<NormalizedMetric[]> {
    if (!connection.accessTokenEnc) {
      throw new Error("Fitbit connection has no stored access token");
    }
    const accessToken = decryptToken(connection.accessTokenEnc);
    const date = todayISO();
    const metrics: NormalizedMetric[] = [];
    const now = new Date();

    // Each call is independently best-effort — a single failing endpoint
    // (e.g. a scope the patient didn't grant) shouldn't blank out every
    // other metric this sync would have produced.
    const attempts: Array<() => Promise<void>> = [
      async () => {
        const data = (await fitbitFetch(`/1/user/-/activities/heart/date/${date}/1d.json`, accessToken)) as {
          "activities-heart": { value: { restingHeartRate?: number } }[];
        };
        const resting = data["activities-heart"]?.[0]?.value?.restingHeartRate;
        if (resting) metrics.push({ metricType: "RESTING_HEART_RATE", value: resting, unit: "bpm", recordedAt: now });
      },
      async () => {
        const data = (await fitbitFetch(`/1/user/-/activities/date/${date}.json`, accessToken)) as {
          summary: { steps?: number; fairlyActiveMinutes?: number; veryActiveMinutes?: number };
        };
        if (typeof data.summary?.steps === "number") {
          metrics.push({ metricType: "STEPS", value: data.summary.steps, unit: "count", recordedAt: now });
        }
        const activeMinutes = (data.summary?.fairlyActiveMinutes ?? 0) + (data.summary?.veryActiveMinutes ?? 0);
        metrics.push({ metricType: "ACTIVE_MINUTES", value: activeMinutes, unit: "minutes", recordedAt: now });
      },
      async () => {
        const data = (await fitbitFetch(`/1.2/user/-/sleep/date/${date}.json`, accessToken)) as {
          summary: { totalMinutesAsleep?: number };
        };
        if (typeof data.summary?.totalMinutesAsleep === "number") {
          metrics.push({ metricType: "SLEEP_MINUTES", value: data.summary.totalMinutesAsleep, unit: "minutes", recordedAt: now });
        }
      },
      async () => {
        const data = (await fitbitFetch(`/1/user/-/body/log/weight/date/${date}.json`, accessToken)) as {
          weight: { weight: number }[];
        };
        const latest = data.weight?.[data.weight.length - 1]?.weight;
        if (latest) metrics.push({ metricType: "WEIGHT_KG", value: latest, unit: "kg", recordedAt: now });
      },
      async () => {
        const data = (await fitbitFetch(`/1/user/-/spo2/date/${date}.json`, accessToken)) as {
          value?: { avg?: number };
        };
        if (typeof data.value?.avg === "number") {
          metrics.push({ metricType: "SPO2", value: data.value.avg, unit: "%", recordedAt: now });
        }
      },
    ];

    const results = await Promise.allSettled(attempts.map((fn) => fn()));
    for (const result of results) {
      if (result.status === "rejected") {
        logger.warn("Fitbit metric fetch partially failed", { error: String(result.reason) });
      }
    }

    return metrics;
  },
};
