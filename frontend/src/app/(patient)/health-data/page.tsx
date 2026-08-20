"use client";

import * as React from "react";
import { HeartPulse, RefreshCw, Unlink, PlugZap, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/shared/states";
import { useToast } from "@/components/shared/toast";
import { HealthTimeline } from "@/components/health/health-timeline";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { HealthProviderInfo, HealthConnection, HealthMetricRecord } from "@/types/api";

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * "Connected Health Data" — patient-facing connection management. Every
 * provider in the catalog is always shown, even if not yet configured
 * (Fitbit) or never connectable from a web app (Apple Health), with an
 * honest reason rather than hiding the option or faking a connection.
 */
export default function HealthDataPage() {
  const toast = useToast();
  const [providers, setProviders] = React.useState<HealthProviderInfo[] | null>(null);
  const [connections, setConnections] = React.useState<HealthConnection[] | null>(null);
  const [metrics, setMetrics] = React.useState<HealthMetricRecord[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyProvider, setBusyProvider] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [providersRes, connectionsRes, metricsRes] = await Promise.all([
        apiFetch<{ providers: HealthProviderInfo[] }>("/health-data/providers"),
        apiFetch<{ connections: HealthConnection[] }>("/health-data/connections"),
        apiFetch<{ metrics: HealthMetricRecord[] }>("/health-data/metrics"),
      ]);
      setProviders(providersRes.providers);
      setConnections(connectionsRes.connections);
      setMetrics(metricsRes.metrics);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't load your connected health data.");
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function connectionFor(providerId: string) {
    return connections?.find((c) => c.provider === providerId && c.status === "CONNECTED") ?? null;
  }

  async function handleConnect(provider: HealthProviderInfo) {
    setBusyProvider(provider.id);
    try {
      const res = await apiFetch<{ authUrl?: string }>(`/health-data/connections/${provider.id}/connect`, {
        method: "POST",
      });
      if (res.authUrl) {
        window.location.href = res.authUrl;
        return;
      }
      toast.success(`${provider.label} connected — demo readings are now available.`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Couldn't connect. Please try again.");
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleSync(providerId: string) {
    setBusyProvider(providerId);
    try {
      await apiFetch(`/health-data/connections/${providerId}/sync`, { method: "POST" });
      toast.success("Synced.");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Sync failed. Please try again.");
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleDisconnect(providerId: string, label: string) {
    setBusyProvider(providerId);
    try {
      await apiFetch(`/health-data/connections/${providerId}`, { method: "DELETE" });
      toast.success(`${label} disconnected.`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Couldn't disconnect. Please try again.");
    } finally {
      setBusyProvider(null);
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!providers || !connections) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-slate-900 dark:text-white">
          <HeartPulse className="text-clinical-blue" size={24} />
          Connected Health Data
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Connect a wearable or health-device source so the triage assistant can consider your recent readings.
          You control what stays connected — disconnect any time and new data stops being shared immediately.
        </p>
      </div>

      <div className="rounded-xl border border-clinical-border bg-clinical-gray p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
        <span className="font-medium">Manually entered</span> data lives in your{" "}
        <span className="font-medium">Medical Profile</span>. Data below is{" "}
        <span className="font-medium">imported from a connected source</span> (Demo data is clearly synthetic —
        never mixed with a real provider's readings). Any triage recommendation using this data is{" "}
        <span className="font-medium">AI-generated</span>, never a diagnosis.
      </div>

      {providers.map((provider) => {
        const connection = connectionFor(provider.id);
        const busy = busyProvider === provider.id;
        return (
          <Card key={provider.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {provider.label}
                  {provider.id === "DEMO" && (
                    <span className="rounded-full bg-triage-moderate/10 px-2 py-0.5 text-xs font-medium text-triage-moderate">
                      Synthetic demo data
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  {connection ? (
                    <>
                      Connected · Last synced {timeAgo(connection.lastSyncedAt)}
                    </>
                  ) : provider.configured ? (
                    "Not connected"
                  ) : (
                    "Not yet available"
                  )}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {!provider.configured && provider.unavailableReason && (
                <p className="mb-3 flex items-start gap-2 rounded-lg bg-clinical-gray p-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  {provider.unavailableReason}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {!connection && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!provider.configured || busy}
                    onClick={() => handleConnect(provider)}
                  >
                    <PlugZap size={16} />
                    {busy ? "Connecting…" : "Connect"}
                  </Button>
                )}
                {connection && (
                  <>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleSync(provider.id)}>
                      <RefreshCw size={16} className={cn(busy && "animate-spin")} />
                      Sync now
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => handleDisconnect(provider.id, provider.label)}
                    >
                      <Unlink size={16} />
                      Disconnect
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold text-slate-900 dark:text-white">Health data timeline</h2>
        <HealthTimeline metrics={metrics} loading={metrics === null} />
      </div>
    </div>
  );
}
