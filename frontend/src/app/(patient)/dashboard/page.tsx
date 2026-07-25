"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UrgencyBadge } from "@/components/ui/badge";
import { CardSkeletonList, EmptyState, ErrorState } from "@/components/shared/states";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { Assessment } from "@/types/api";

type HistoryResponse = { medicalHistory: unknown[]; assessments: Assessment[] };

export default function PatientDashboardPage() {
  const [assessments, setAssessments] = React.useState<Assessment[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setError(null);
    setAssessments(null);
    apiFetch<HistoryResponse>("/patients/me/history")
      .then((res) => setAssessments(res.assessments))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Couldn't load your history."));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Your care overview
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Start a new assessment any time your symptoms change.
          </p>
        </div>
        <Link href="/assessment/new">
          <Button>
            <Plus size={18} />
            New assessment
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Previous assessments</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <ErrorState message={error} onRetry={load} />}

          {!error && assessments === null && <CardSkeletonList count={3} />}

          {!error && assessments !== null && assessments.length === 0 && (
            <EmptyState
              title="No assessments yet"
              description="Once you complete a symptom check-in, it'll show up here along with any recommendation and your report."
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
                    <p className="font-mono text-xs text-slate-400">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {typeof a.intake.primarySymptom === "string"
                        ? a.intake.primarySymptom
                        : "Symptom assessment"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Status: {a.status.replace("_", " ").toLowerCase()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.urgencyLevel && <UrgencyBadge level={a.urgencyLevel} />}
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api"}/reports/${a.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-clinical-gray hover:text-clinical-blue dark:hover:bg-slate-800"
                      title="Download report"
                    >
                      <FileDown size={18} />
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
