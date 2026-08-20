import type { HealthDataProvider, NormalizedMetric } from "@/health/provider.interface";

/**
 * Apple HealthKit has NO public web/REST API — it is an on-device iOS
 * framework, reachable only from a native Swift/Objective-C app (or a paid
 * third-party aggregator like Terra/Validic/Human API that has already
 * built that native bridge). Neither exists yet in this project, so this
 * provider is intentionally never connectable through the normal web
 * "Connect" flow — it exists so the interface has a slot for it and the UI
 * can show an honest, specific reason instead of a fake "Connect" button
 * or hiding the option entirely.
 *
 * The shared ingest endpoint (POST /health-data/connections/APPLE_HEALTH/ingest,
 * see health-connection.service.ts `ingest()`) is already wired up and
 * ready for a future iOS companion app to push validated readings through
 * — building that app is a separate, not-yet-approved phase of work.
 */
export const appleHealthProvider: HealthDataProvider = {
  id: "APPLE_HEALTH",
  label: "Apple Health",
  requiresNativeApp: true,

  isConfigured() {
    return false;
  },

  unavailableReason() {
    return "Apple Health has no public web API. It requires a native iOS companion app (not yet built) to read HealthKit data on-device and send it here — a paid third-party aggregator (e.g. Terra, Validic, Human API) is the only alternative, and none is configured.";
  },

  async fetchMetrics(): Promise<NormalizedMetric[]> {
    throw new Error("Apple Health has no pull-based sync — data arrives only via the native-app ingest endpoint.");
  },
};
