"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeletonList, ErrorState, EmptyState } from "@/components/shared/states";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { AuditLogEntry } from "@/types/api";

export default function AuditLogsPage() {
  const [logs, setLogs] = React.useState<AuditLogEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setError(null);
    apiFetch<{ logs: AuditLogEntry[] }>("/admin/audit-logs")
      .then((res) => setLogs(res.logs))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Couldn't load audit logs."));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 font-display text-2xl font-bold text-slate-900 dark:text-white">Audit logs</h1>
      <Card>
        <CardHeader>
          <CardTitle>Recent system activity</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <ErrorState message={error} onRetry={load} />}
          {!error && logs === null && <CardSkeletonList count={6} />}
          {!error && logs !== null && logs.length === 0 && (
            <EmptyState title="No activity recorded yet" description="Actions across the system will appear here." />
          )}
          {!error && logs !== null && logs.length > 0 && (
            <ul className="divide-y divide-clinical-border dark:divide-slate-800">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{log.action.replace(/_/g, " ").toLowerCase()}</p>
                    <p className="text-xs text-slate-400">
                      {log.user ? `${log.user.email} (${log.user.role.toLowerCase()})` : "System"}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
