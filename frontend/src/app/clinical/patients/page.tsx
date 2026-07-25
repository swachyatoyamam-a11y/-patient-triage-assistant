"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { UrgencyBadge, Badge } from "@/components/ui/badge";
import { TableRowsSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { Assessment, UrgencyLevel, AssessmentStatus } from "@/types/api";
import { cn } from "@/lib/utils";

const URGENCY_FILTERS: (UrgencyLevel | "ALL")[] = ["ALL", "EMERGENCY", "URGENT", "MODERATE", "ROUTINE"];
const STATUS_FILTERS: (AssessmentStatus | "ALL")[] = [
  "ALL", "IN_PROGRESS", "AWAITING_REVIEW", "REVIEWED", "RESOLVED", "CANCELLED",
];
const URGENCY_RANK: Record<UrgencyLevel, number> = { EMERGENCY: 0, URGENT: 1, MODERATE: 2, ROUTINE: 3 };
const PAGE_SIZE = 15;

type SortKey = "newest" | "oldest" | "urgency";

function statusLabel(status: string) {
  return status.replace("_", " ").toLowerCase();
}

function ageSex(intake: Record<string, unknown>): string {
  const age = typeof intake.age === "number" ? intake.age : null;
  const sex = typeof intake.sex === "string" ? intake.sex : null;
  if (age && sex) return `${age} / ${sex[0]}`;
  if (age) return `${age}`;
  return "—";
}

export default function AllPatientsPage() {
  const [assessments, setAssessments] = React.useState<Assessment[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [urgencyFilter, setUrgencyFilter] = React.useState<UrgencyLevel | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = React.useState<AssessmentStatus | "ALL">("ALL");
  const [sort, setSort] = React.useState<SortKey>("newest");
  const [page, setPage] = React.useState(1);

  const load = React.useCallback(() => {
    setError(null);
    apiFetch<{ assessments: Assessment[] }>("/assessments?limit=500")
      .then((res) => setAssessments(res.assessments))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Couldn't load patients."));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [search, urgencyFilter, statusFilter, sort]);

  const filtered = React.useMemo(() => {
    let rows = assessments ?? [];
    if (urgencyFilter !== "ALL") rows = rows.filter((a) => a.urgencyLevel === urgencyFilter);
    if (statusFilter !== "ALL") rows = rows.filter((a) => a.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((a) => {
        const name = a.patient ? `${a.patient.user.firstName} ${a.patient.user.lastName}` : "";
        const symptom = typeof a.intake.primarySymptom === "string" ? a.intake.primarySymptom : "";
        return `${name} ${symptom}`.toLowerCase().includes(q);
      });
    }
    const sorted = [...rows].sort((a, b) => {
      if (sort === "urgency") {
        const ra = a.urgencyLevel ? URGENCY_RANK[a.urgencyLevel] : 99;
        const rb = b.urgencyLevel ? URGENCY_RANK[b.urgencyLevel] : 99;
        if (ra !== rb) return ra - rb;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === "oldest" ? -diff : diff;
    });
    return sorted;
  }, [assessments, search, urgencyFilter, statusFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function cycleSort() {
    setSort((s) => (s === "newest" ? "oldest" : s === "oldest" ? "urgency" : "newest"));
  }

  const sortLabel = sort === "newest" ? "Newest first" : sort === "oldest" ? "Oldest first" : "Most urgent first";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">All patients</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {assessments === null ? "Loading…" : `${assessments.length} assessment${assessments.length === 1 ? "" : "s"} on record`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient or symptom…"
            className="w-full rounded-full border border-clinical-border bg-white py-2.5 pl-9 pr-4 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </div>
        <button
          onClick={cycleSort}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-clinical-border bg-white px-4 text-sm font-medium text-slate-600 hover:bg-clinical-gray dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ArrowUpDown size={14} />
          {sortLabel}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Urgency</span>
        {URGENCY_FILTERS.map((level) => (
          <button
            key={level}
            onClick={() => setUrgencyFilter(level)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              urgencyFilter === level
                ? "bg-clinical-blue text-white"
                : "border border-clinical-border bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
            )}
          >
            {level === "ALL" ? "All" : level.charAt(0) + level.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</span>
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              statusFilter === status
                ? "bg-clinical-blueDark text-white"
                : "border border-clinical-border bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
            )}
          >
            {status === "ALL" ? "All" : statusLabel(status)}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-clinical-border text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Age / Sex</th>
                  <th className="px-4 py-3 font-medium">Chief complaint</th>
                  <th className="px-4 py-3 font-medium">Urgency</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {assessments === null && <TableRowsSkeleton rows={8} cols={6} />}
                {assessments !== null &&
                  pageRows.map((a) => (
                    <tr
                      key={a.id}
                      className="cursor-pointer border-b border-clinical-border transition-colors last:border-0 hover:bg-clinical-gray dark:border-slate-800 dark:hover:bg-slate-800/60"
                    >
                      <td className="px-4 py-3.5">
                        <Link href={`/clinical/patients/${a.id}`} className="font-medium text-slate-800 hover:text-clinical-blue dark:text-slate-100">
                          {a.patient ? `${a.patient.user.firstName} ${a.patient.user.lastName}` : "Patient"}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {ageSex(a.intake)}
                      </td>
                      <td className="max-w-[16rem] truncate px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {typeof a.intake.primarySymptom === "string" ? a.intake.primarySymptom : "—"}
                      </td>
                      <td className="px-4 py-3.5">{a.urgencyLevel ? <UrgencyBadge level={a.urgencyLevel} /> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3.5"><Badge>{statusLabel(a.status)}</Badge></td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-clinical-border md:hidden dark:divide-slate-800">
            {assessments === null &&
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-2 p-4">
                  <div className="h-4 w-1/2 rounded bg-clinical-border/60 dark:bg-slate-800" />
                  <div className="h-3 w-2/3 rounded bg-clinical-border/60 dark:bg-slate-800" />
                </div>
              ))}
            {assessments !== null &&
              pageRows.map((a) => (
                <Link key={a.id} href={`/clinical/patients/${a.id}`} className="block p-4 active:bg-clinical-gray dark:active:bg-slate-800/60">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {a.patient ? `${a.patient.user.firstName} ${a.patient.user.lastName}` : "Patient"}
                    </p>
                    {a.urgencyLevel && <UrgencyBadge level={a.urgencyLevel} />}
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {ageSex(a.intake)} · {typeof a.intake.primarySymptom === "string" ? a.intake.primarySymptom : "—"}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge>{statusLabel(a.status)}</Badge>
                    <span className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
          </div>

          {assessments !== null && filtered.length === 0 && (
            <div className="p-2">
              <EmptyState title="No patients match" description="Try a different search term or clear your filters." />
            </div>
          )}
        </Card>
      )}

      {!error && assessments !== null && filtered.length > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Users size={14} />
            {filtered.length} match{filtered.length === 1 ? "" : "es"} · page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-clinical-border disabled:opacity-30 dark:border-slate-700"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-clinical-border disabled:opacity-30 dark:border-slate-700"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
