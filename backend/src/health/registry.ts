import type { HealthDataProvider } from "@/health/provider.interface";
import { demoProvider } from "@/health/providers/demo-provider";
import { fitbitProvider } from "@/health/providers/fitbit-provider";
import { appleHealthProvider } from "@/health/providers/apple-health-provider";

export const HEALTH_PROVIDERS: HealthDataProvider[] = [demoProvider, fitbitProvider, appleHealthProvider];

export function getProvider(id: string): HealthDataProvider {
  const provider = HEALTH_PROVIDERS.find((p) => p.id === id);
  if (!provider) throw new Error(`Unknown health data provider: ${id}`);
  return provider;
}
