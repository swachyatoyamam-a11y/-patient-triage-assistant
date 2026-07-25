"use client";

import * as React from "react";
import { UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeletonList, ErrorState, EmptyState } from "@/components/shared/states";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { AdminUser } from "@/types/api";

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setError(null);
    apiFetch<{ users: AdminUser[] }>("/admin/users")
      .then((res) => setUsers(res.users))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Couldn't load users."));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function deactivate(id: string) {
    if (!confirm("Deactivate this user? They'll immediately lose access.")) return;
    try {
      await apiFetch(`/admin/users/${id}/deactivate`, { method: "PATCH" });
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't deactivate that user.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 font-display text-2xl font-bold text-slate-900 dark:text-white">Users</h1>
      <Card>
        <CardHeader>
          <CardTitle>All accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <ErrorState message={error} onRetry={load} />}
          {!error && users === null && <CardSkeletonList count={5} />}
          {!error && users !== null && users.length === 0 && (
            <EmptyState title="No users yet" description="Registered accounts will show up here." />
          )}
          {!error && users !== null && users.length > 0 && (
            <ul className="space-y-2">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between rounded-xl border border-clinical-border p-4 dark:border-slate-800"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge>{u.role.toLowerCase()}</Badge>
                    {!u.isActive ? (
                      <span className="text-xs font-semibold text-slate-400">Deactivated</span>
                    ) : (
                      <button
                        onClick={() => deactivate(u.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-triage-emergency/10 hover:text-triage-emergency"
                        title="Deactivate user"
                      >
                        <UserX size={16} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
