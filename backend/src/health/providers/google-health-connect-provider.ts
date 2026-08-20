import type { HealthDataProvider, NormalizedMetric } from "@/health/provider.interface";

/**
 * Android Health Connect (the successor to Google Fit's now-deprecated
 * cloud REST API) is an on-device data store with a Kotlin/Java SDK — like
 * HealthKit, it has no cloud API a backend can call on the user's behalf.
 * This provider is intentionally never connectable through the normal web
 * "Connect" flow for the same reason as Apple Health — see
 * apple-health-provider.ts for the fuller explanation, which applies here
 * identically. It exists so the interface has a slot for it and the UI
 * shows an honest, specific reason instead of a fake "Connect" button.
 *
 * The shared ingest endpoint
 * (POST /health-data/connections/GOOGLE_HEALTH_CONNECT/ingest, see
 * health-connection.service.ts `ingest()`) is already wired up and ready
 * for a future Android companion app to push validated readings through —
 * building that app is a separate, not-yet-approved phase of work.
 */
export const googleHealthConnectProvider: HealthDataProvider = {
  id: "GOOGLE_HEALTH_CONNECT",
  label: "Google Health Connect",
  requiresNativeApp: true,

  isConfigured() {
    return false;
  },

  unavailableReason() {
    return "Google Health Connect has no cloud API — it requires a native Android companion app (not yet built) to read on-device data and send it here. There is no web-only path to this data.";
  },

  async fetchMetrics(): Promise<NormalizedMetric[]> {
    throw new Error("Google Health Connect has no pull-based sync — data arrives only via the native-app ingest endpoint.");
  },
};
