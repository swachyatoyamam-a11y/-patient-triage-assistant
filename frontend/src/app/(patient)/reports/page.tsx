"use client";

import * as React from "react";
import { FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UrgencyBadge } from "@/components/ui/badge";
import { CardSkeletonList, EmptyState, ErrorState } from "@/components/shared/states";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { Assessment } from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export default function ReportsPage() {
  const [assessments, setAssessments] = React.useState<Assessment[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setError(null);
    setAssessments(null);
    apiFetch<{ assessments: Assessment[] }>("/patients/me/history")
      .then((res) => setAssessments(res.assessments))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Couldn't load your reports."));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 font-display text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
      <Card>
        <CardHeader>
          <CardTitle>Downloadable assessment reports</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <ErrorState message={error} onRetry={load} />}
          {!error && assessments === null && <CardSkeletonList count={3} />}
          {!error && assessments !== null && assessments.length === 0 && (
            <EmptyState
              title="Nothing to download yet"
              description="Complete an assessment and its report will appear here as a PDF."
            />
          )}
          {!error && assessments !== null && assessments.length > 0 && (
            <ul className="space-y-3">
              {assessments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-clinical-border p-4 dark:border-slate-800"
                >
                  <div>
                    <p className="font-mono text-xs text-slate-400">{new Date(a.createdAt).toLocaleDateString()}</p>
                    <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {typeof a.intake.primarySymptom === "string" ? a.intake.primarySymptom : "Assessment"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.urgencyLevel && <UrgencyBadge level={a.urgencyLevel} />}
                    <a
                      href={`${API_BASE_URL}/reports/${a.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-full border border-clinical-border px-3 py-1.5 text-xs font-medium text-clinical-blueDark hover:bg-clinical-gray dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
                    >
                      <FileDown size={14} />
                      PDF
                    </a>
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
