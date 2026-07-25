"use client";

import * as React from "react";
import Link from "next/link";
import { Search, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UrgencyBadge, Badge } from "@/components/ui/badge";
import { CardSkeletonList, EmptyState, ErrorState } from "@/components/shared/states";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { Assessment, UrgencyLevel } from "@/types/api";

const URGENCY_FILTERS: (UrgencyLevel | "ALL")[] = ["ALL", "EMERGENCY", "URGENT", "MODERATE", "ROUTINE"];

function timeSince(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

export default function ClinicalDashboardPage() {
  const [assessments, setAssessments] = React.useState<Assessment[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = React.useState<UrgencyLevel | "ALL">("ALL");
  const [search, setSearch] = React.useState("");

  const load = React.useCallback(() => {
    setError(null);
    // No pagination UI yet — request a generous limit so the search box
    // below can actually search the full active queue, not just the
    // first page of results.
    const params = new URLSearchParams({ limit: "500" });
    if (urgencyFilter !== "ALL") params.set("urgency", urgencyFilter);
    apiFetch<{ assessments: Assessment[] }>(`/assessments?${params.toString()}`)
      .then((res) => setAssessments(res.assessments))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Couldn't load the queue."));
  }, [urgencyFilter]);

  React.useEffect(() => {
    setAssessments(null);
    load();
    // Live-feeling queue: poll every 20s rather than a full websocket layer
    // for now — swap for a websocket/SSE push in a later pass if the
    // 20s lag matters in practice.
    const interval = setInterval(load, 20_000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = (assessments ?? []).filter((a) => {
    if (!search.trim()) return true;
    const symptom = typeof a.intake.primarySymptom === "string" ? a.intake.primarySymptom : "";
    const name = a.patient ? `${a.patient.user.firstName} ${a.patient.user.lastName}` : "";
    const haystack = `${symptom} ${name}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Live queue</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sorted by urgency automatically. Refreshes every 20 seconds.
          </p>
        </div>
        <button
          onClick={load}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-clinical-border text-slate-500 hover:bg-clinical-gray dark:border-slate-700 dark:hover:bg-slate-800"
          title="Refresh now"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient or symptom…"
            className="w-full rounded-full border border-clinical-border bg-white py-2.5 pl-9 pr-4 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {URGENCY_FILTERS.map((level) => (
            <button
              key={level}
              onClick={() => setUrgencyFilter(level)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                urgencyFilter === level
                  ? "bg-clinical-blue text-white"
                  : "bg-white text-slate-500 border border-clinical-border dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              }`}
            >
              {level === "ALL" ? "All" : level.charAt(0) + level.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Patients awaiting review</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <ErrorState message={error} onRetry={load} />}
          {!error && assessments === null && <CardSkeletonList count={4} />}
          {!error && assessments !== null && filtered.length === 0 && (
            <EmptyState title="Queue is clear" description="No patients match the current filter." />
          )}
          {!error && filtered.length > 0 && (
            <ul className="space-y-2">
              {filtered.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/clinical/patients/${a.id}`}
                    className="flex items-center justify-between rounded-xl border border-clinical-border p-4 transition-colors hover:bg-clinical-gray dark:border-slate-800 dark:hover:bg-slate-800/60"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {a.patient ? `${a.patient.user.firstName} ${a.patient.user.lastName}` : "Patient"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {typeof a.intake.primarySymptom === "string" ? a.intake.primarySymptom : "—"}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-slate-400">{timeSince(a.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{a.status.replace("_", " ").toLowerCase()}</Badge>
                      {a.urgencyLevel && <UrgencyBadge level={a.urgencyLevel} />}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
