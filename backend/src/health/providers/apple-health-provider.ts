import type { HealthDataProvider, NormalizedMetric } from "@/health/provider.interface";

/**
 * Apple HealthKit has NO public web/REST API — it is an on-device iOS
 * framework, reachable only from a native Swift/Objective-C app (or a paid
 * third-party aggregator like Terra/Validic/Human API that has already
 * built that native bridge). Neither is available in this web-only
 * architecture, so this provider is intentionally never connectable —
 * it exists so the interface has a slot for it and the UI can show an
 * honest, specific reason instead of a fake "Connect" button or hiding
 * the option entirely.
 */
export const appleHealthProvider: HealthDataProvider = {
  id: "APPLE_HEALTH",
  label: "Apple Health",

  isConfigured() {
    return false;
  },

  unavailableReason() {
    return "Apple Health has no public web API — it requires a native iOS companion app, or a paid third-party aggregator (e.g. Terra, Validic, Human API) with its own integration. Not possible from this web app alone.";
  },

  async fetchMetrics(): Promise<NormalizedMetric[]> {
    throw new Error("Apple Health is not connectable from this web application.");
  },
};
