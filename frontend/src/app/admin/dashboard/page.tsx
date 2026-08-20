"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import {
  Users, Siren, Clock, CheckCircle2, Activity, Sparkles, ListChecks,
  UserPlus, ShieldAlert, GitPullRequestArrow, TimerReset, AlertOctagon, HeartPulse,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UrgencyBadge, Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { ErrorState, Skeleton, EmptyState } from "@/components/shared/states";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import type { AnalyticsSummary, Assessment, SymptomFrequency, ExtendedAnalyticsSummary } from "@/types/api";
import { URGENCY_META, type UrgencyLevel } from "@/lib/utils";

// Fixed status-severity order — never reordered by count, matches the
// UrgencyBadge color meaning everywhere else in the app.
const URGENCY_ORDER: UrgencyLevel[] = ["EMERGENCY", "URGENT", "MODERATE", "ROUTINE"];
const URGENCY_HEX: Record<UrgencyLevel, string> = {
  EMERGENCY: "#DC2626",
  URGENT: "#EA580C",
  MODERATE: "#CA8A04",
  ROUTINE: "#16A34A",
};

// Validated categorical palette (dataviz skill, default order) — used only
// for non-urgency series so it's never confused with the triage status colors.
const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a"];

type SourceBucket = "Rule engine" | "AI model" | "Imported reference";

function classifySource(modelName: string | undefined): SourceBucket {
  if (!modelName) return "Imported reference";
  if (modelName === "rule-engine-v1") return "Rule engine";
  if (modelName === "sample-data-import") return "Imported reference";
  return "AI model";
}

/**
 * recharts' <ResponsiveContainer> measures via ResizeObserver, which some
 * embedding/automation contexts never fire in — leaving the chart mounted
 * with a correctly-sized wrapper div but zero children, forever. Measuring
 * the container ourselves with a synchronous getBoundingClientRect() in
 * useLayoutEffect sidesteps that dependency entirely.
 */
function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    function measure() {
      if (ref.current) setWidth(ref.current.getBoundingClientRect().width);
    }
    measure();
    window.addEventListener("resize", measure);
    const interval = setInterval(measure, 500);
    return () => {
      window.removeEventListener("resize", measure);
      clearInterval(interval);
    };
  }, []);
  return [ref, width] as const;
}

function timeSince(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export default function AdminDashboardPage() {
  const [summary, setSummary] = React.useState<AnalyticsSummary | null>(null);
  const [extended, setExtended] = React.useState<ExtendedAnalyticsSummary | null>(null);
  const [symptoms, setSymptoms] = React.useState<SymptomFrequency[] | null>(null);
  const [assessments, setAssessments] = React.useState<Assessment[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [urgencyRef, urgencyWidth] = useElementWidth<HTMLDivElement>();
  const [symptomsRef, symptomsWidth] = useElementWidth<HTMLDivElement>();
  const [volumeRef, volumeWidth] = useElementWidth<HTMLDivElement>();
  const [conditionsRef, conditionsWidth] = useElementWidth<HTMLDivElement>();

  const load = React.useCallback(() => {
    setError(null);
    Promise.all([
      apiFetch<AnalyticsSummary>("/analytics/summary"),
      apiFetch<{ symptoms: SymptomFrequency[] }>("/analytics/common-symptoms"),
      apiFetch<{ assessments: Assessment[] }>("/assessments?limit=500"),
      apiFetch<ExtendedAnalyticsSummary>("/analytics/extended-summary"),
    ])
      .then(([s, sym, a, ext]) => {
        setSummary(s);
        setSymptoms(sym.symptoms);
        setAssessments(a.assessments);
        setExtended(ext);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Couldn't load analytics."));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;

  const loading = !summary || !assessments || !symptoms || !extended;

  const totalPatients = assessments ? new Set(assessments.map((a) => a.patientId)).size : 0;
  const totalAssessments = assessments?.length ?? 0;
  const reviewedCount =
    assessments?.filter((a) => a.status === "REVIEWED" || a.status === "RESOLVED").length ?? 0;
  const reviewRate = totalAssessments > 0 ? Math.round((reviewedCount / totalAssessments) * 100) : 0;

  const urgencyChartData = URGENCY_ORDER.map((level) => ({
    name: URGENCY_META[level].label,
    count: assessments?.filter((a) => a.urgencyLevel === level).length ?? 0,
    color: URGENCY_HEX[level],
  }));

  const sourceCounts: Record<SourceBucket, number> = {
    "Rule engine": 0,
    "AI model": 0,
    "Imported reference": 0,
  };
  for (const a of assessments ?? []) {
    sourceCounts[classifySource(a.recommendation?.modelName)]++;
  }
  const sourceTotal = Object.values(sourceCounts).reduce((s, n) => s + n, 0) || 1;
  const sourceEntries = (Object.entries(sourceCounts) as [SourceBucket, number][]).filter(([, n]) => n > 0);

  const topSymptoms = (symptoms ?? []).slice(0, 8).map((s) => ({ name: s.symptom, count: s.count }));

  const recent = [...(assessments ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">System overview</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Live metrics across every patient and assessment in the system.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total patients" value={totalPatients} icon={Users} accent="blue" loading={loading} />
        <StatCard label="Total assessments" value={totalAssessments} icon={ListChecks} accent="blue" loading={loading} />
        <StatCard
          label="Emergency cases today"
          value={summary?.emergencyCases}
          icon={Siren}
          accent="emergency"
          loading={loading}
        />
        <StatCard
          label="Avg. wait to review"
          value={summary?.averageWaitMinutes ? `${Math.round(summary.averageWaitMinutes)}m` : "—"}
          sublabel="today's reviewed cases"
          icon={Clock}
          accent="urgent"
          loading={loading}
        />
        <StatCard
          label="Review rate"
          value={`${reviewRate}%`}
          sublabel={`${reviewedCount} of ${totalAssessments}`}
          icon={CheckCircle2}
          accent="routine"
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Urgency distribution</CardTitle>
            <CardDescription>Every assessment currently on record, by triage level.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : totalAssessments === 0 ? (
              <EmptyState title="No assessments yet" description="Data will appear here once patients are triaged." />
            ) : (
              <div ref={urgencyRef} className="w-full">
                {urgencyWidth > 0 && (
                  <BarChart width={urgencyWidth} height={260} data={urgencyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 13 }}
                      cursor={{ fill: "rgba(30,93,170,0.05)" }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
                      {urgencyChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>How each recommendation was made</CardTitle>
            <CardDescription>The hybrid pipeline in one view.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : sourceTotal <= 1 && sourceEntries.length === 0 ? (
              <EmptyState title="No recommendations yet" description="This fills in as assessments are analyzed." />
            ) : (
              <div className="space-y-5 pt-2">
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-clinical-gray dark:bg-slate-800">
                  {sourceEntries.map(([label, count], i) => (
                    <div
                      key={label}
                      style={{ width: `${(count / sourceTotal) * 100}%`, backgroundColor: CATEGORICAL[i] }}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      title={`${label}: ${count}`}
                    />
                  ))}
                </div>
                <ul className="space-y-3">
                  {sourceEntries.map(([label, count], i) => (
                    <li key={label} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: CATEGORICAL[i] }}
                        />
                        {label}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {count} · {Math.round((count / sourceTotal) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Most common symptoms</CardTitle>
            <CardDescription>Across every intake on record.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : topSymptoms.length === 0 ? (
              <EmptyState title="No symptoms recorded" description="Symptoms will rank here as intakes come in." />
            ) : (
              <div ref={symptomsRef} className="w-full">
                {symptomsWidth > 0 && (
                  <BarChart
                    width={symptomsWidth}
                    height={Math.max(220, topSymptoms.length * 34)}
                    data={topSymptoms}
                    layout="vertical"
                    margin={{ left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 13 }} />
                    <Bar dataKey="count" fill="#1E5DAA" radius={[0, 6, 6, 0]} maxBarSize={18} />
                  </BarChart>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>Latest assessments across the system.</CardDescription>
              </div>
              <Activity size={18} className="text-slate-300 dark:text-slate-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <EmptyState title="Nothing yet" description="New assessments will show up here first." />
            ) : (
              <ul className="space-y-1">
                {recent.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/clinical/patients/${a.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-clinical-gray dark:hover:bg-slate-800/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {a.patient ? `${a.patient.user.firstName} ${a.patient.user.lastName}` : "Patient"}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {typeof a.intake.primarySymptom === "string" ? a.intake.primarySymptom : "—"} ·{" "}
                          {timeSince(a.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {a.urgencyLevel && <UrgencyBadge level={a.urgencyLevel} />}
                        <Badge className="hidden sm:inline-flex">{a.status.replace("_", " ").toLowerCase()}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold text-slate-900 dark:text-white">
          Patients &amp; system health
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard
            label="New patients (7d)"
            value={extended?.newPatientsThisWeek}
            sublabel={extended ? `${extended.newPatientsThisMonth} in 30d` : undefined}
            icon={UserPlus}
            accent="blue"
            loading={loading}
          />
          <StatCard
            label="Active patients (30d)"
            value={extended?.activePatientCount}
            icon={Users}
            accent="blue"
            loading={loading}
          />
          <StatCard
            label="Requiring review"
            value={extended?.patientsRequiringReview}
            sublabel="distinct patients"
            icon={ListChecks}
            accent="urgent"
            loading={loading}
          />
          <StatCard
            label="High-risk patients"
            value={extended?.highRiskPatientCount}
            sublabel="chronic condition + recent severe visit"
            icon={HeartPulse}
            accent="emergency"
            loading={loading}
          />
          <StatCard
            label="AI escalation rate"
            value={extended ? `${Math.round(extended.aiEscalationRate)}%` : undefined}
            sublabel="AI raised urgency over the rule floor"
            icon={Sparkles}
            accent="blue"
            loading={loading}
          />
          <StatCard
            label="Clinician overrides"
            value={extended?.clinicianOverrideCount}
            icon={GitPullRequestArrow}
            accent="urgent"
            loading={loading}
          />
          <StatCard
            label="Avg. processing time"
            value={
              extended?.averageProcessingMinutes != null ? `${Math.round(extended.averageProcessingMinutes)}m` : "—"
            }
            sublabel="assessment to recommendation"
            icon={TimerReset}
            accent="routine"
            loading={loading}
          />
          <StatCard
            label="AI/API errors"
            value={extended?.aiErrorCount}
            icon={AlertOctagon}
            accent="emergency"
            loading={loading}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Assessment volume (14 days)</CardTitle>
            <CardDescription>New assessments submitted per day.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : !extended || extended.assessmentVolumeOverTime.length === 0 ? (
              <EmptyState title="No recent activity" description="Volume will chart here once assessments come in." />
            ) : (
              <div ref={volumeRef} className="w-full">
                {volumeWidth > 0 && (
                  <LineChart width={volumeWidth} height={220} data={extended.assessmentVolumeOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(d: string) => d.slice(5)}
                      minTickGap={20}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 13 }} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#2a78d6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Common conditions on file</CardTitle>
            <CardDescription>Active conditions across every patient's medical profile.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : !extended || extended.commonConditions.length === 0 ? (
              <EmptyState
                title="No conditions on file"
                description="Fills in as patients complete their medical profile."
              />
            ) : (
              <div ref={conditionsRef} className="w-full">
                {conditionsWidth > 0 && (
                  <BarChart
                    width={conditionsWidth}
                    height={Math.max(180, extended.commonConditions.length * 32)}
                    data={extended.commonConditions.map((c) => ({ name: c.condition, count: c.count }))}
                    layout="vertical"
                    margin={{ left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 13 }} />
                    <Bar dataKey="count" fill="#1baf7a" radius={[0, 6, 6, 0]} maxBarSize={18} />
                  </BarChart>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!loading && extended && extended.abnormalVitalsCount > 0 && (
        <Card className="border-triage-moderate/30 bg-triage-moderate/5">
          <CardContent className="flex items-center gap-3 py-4">
            <ShieldAlert size={18} className="shrink-0 text-triage-moderate" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium text-triage-moderate">{extended.abnormalVitalsCount}</span> recorded
              vitals reading{extended.abnormalVitalsCount === 1 ? "" : "s"} on file outside the normal range —
              reviewable from each patient's assessment detail.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && sourceCounts["AI model"] === 0 && (
        <Card className="border-clinical-blue/20 bg-clinical-blue/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Sparkles size={18} className="shrink-0 text-clinical-blue" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No assessments have been analyzed by an AI model yet — set{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs dark:bg-slate-900">
                GEMINI_API_KEY
              </code>{" "}
              in <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs dark:bg-slate-900">backend/.env</code>{" "}
              and re-analyze an assessment to see it here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
